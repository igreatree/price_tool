import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Collapse, Group, NumberInput, Select, Stack, Switch, Table, Text, TextInput, Title } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { productsApi } from "../../api/products";
import { supplierPricesApi } from "../../api/supplierPrices";
import { marketplaceParamsApi } from "../../api/marketplaceParams";
import { expensesApi } from "../../api/expenses";
import { rulesApi } from "../../api/rules";
import type { ConditionGroup, Marketplace, Rule, RuleSchedule, RuleScheduleEntry, WeekDay } from "../../types";
import { ConditionBuilder } from "./ConditionBuilder";
import { ExpressionInput } from "../../components/ExpressionInput";
import { ScriptInput } from "../../components/ScriptInput";
import { conditionGroupToExpression, emptyConditionGroup } from "../../engine/conditionBuilder";
import { evaluateCondition, type ExpressionContext } from "../../engine/expression";
import { runActionScript, runExpressionScript } from "../../engine/js-script";
import { DAY_LABELS, DEFAULT_SCHEDULE_TIME, WEEK_DAYS, hasActiveSchedule } from "./ruleSchedule";

interface Props {
  marketplace: Marketplace;
  rule: Rule | null;
  onSaved: () => void;
}

interface ContextDiffEntry {
  key: string;
  before: unknown;
  after: unknown;
}

interface PreviewResult {
  matches: boolean;
  price?: number;
  netProceeds?: number;
  marginRatio?: number;
  diff?: ContextDiffEntry[];
  warnings?: string[];
  error?: string;
}

/** Переменные, которые скрипт действия правила не должен затирать — см. backend/src/pricing/calculate-price.ts. */
function protectedContextKeys(extra: Record<string, string | number>): Set<string> {
  return new Set([
    "cost",
    "brand",
    "name",
    "externalId",
    "bestSupplierPrice",
    "supplierPricesCount",
    "supplierPrice",
    "expensesTotal",
    ...Object.keys(extra ?? {}),
  ]);
}

function diffContext(before: ExpressionContext, after: ExpressionContext): ContextDiffEntry[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: ContextDiffEntry[] = [];
  for (const key of keys) {
    if (typeof before[key] === "function" || typeof after[key] === "function") continue;
    if (before[key] !== after[key]) diffs.push({ key, before: before[key], after: after[key] });
  }
  return diffs;
}

export function RuleForm({ marketplace, rule, onSaved }: Props) {
  const [name, setName] = useState(rule?.name ?? "");
  const [priority, setPriority] = useState<number | string>(rule?.priority ?? 100);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [conditionMode, setConditionMode] = useState<Rule["conditionMode"]>(rule?.conditionMode ?? "builder");
  const [conditionGroup, setConditionGroup] = useState<ConditionGroup>(rule?.conditionGroup ?? emptyConditionGroup());
  const [rawCondition, setRawCondition] = useState(rule?.rawCondition ?? "");
  const [actionScript, setActionScript] = useState(rule?.actionScript ?? "");
  const [isFinal, setIsFinal] = useState(rule?.isFinal ?? true);
  const [schedule, setSchedule] = useState<RuleSchedule>(rule?.schedule ?? {});
  const [scheduleOpened, setScheduleOpened] = useState(hasActiveSchedule(rule?.schedule ?? {}));

  const [previewProductId, setPreviewProductId] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const productOptions = useMemo(() => (products ?? []).map((p) => ({ value: p.id, label: `${p.externalId} — ${p.name}` })), [products]);
  const extraKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of products ?? []) {
      for (const key of Object.keys(p.extra)) keys.add(key);
    }
    return Array.from(keys).sort();
  }, [products]);

  function updateScheduleDay(day: WeekDay, patch: Partial<RuleScheduleEntry> | null) {
    setSchedule((prev) => {
      if (patch === null) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      const current = prev[day] ?? { action: "enable" as const, time: DEFAULT_SCHEDULE_TIME };
      return { ...prev, [day]: { ...current, ...patch } };
    });
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      priority: Number(priority) || 0,
      enabled,
      conditionMode,
      conditionGroup,
      rawCondition,
      actionScript: actionScript.trim(),
      isFinal,
      schedule,
    };
    setSaving(true);
    try {
      if (rule) {
        await rulesApi.update(rule.id, input);
      } else {
        await rulesApi.create(marketplace.id, input);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!previewProductId) return;
    setPreviewing(true);
    try {
      await runPreview();
    } finally {
      setPreviewing(false);
    }
  }

  /**
   * В отличие от старого превью (которое проверяло правило изолированно), теперь нужен весь каскад:
   * правило больше не считает цену само — оно лишь меняет переменные основной формулы маркетплейса.
   * Поэтому подставляем текущий черновик на его место среди остальных сохранённых правил и прогоняем
   * тот же алгоритм, что и на сервере (backend/src/pricing/calculate-price.ts): startPriceScript →
   * каскад правил по приоритету → priceFormulaScript. Мин/макс цену и округление превью не применяет.
   */
  async function runPreview() {
    if (!previewProductId) return;
    const warnings: string[] = [];
    const [product, supplierPrices, marketplaceParamsList, expenses, savedRules] = await Promise.all([
      productsApi.get(previewProductId),
      supplierPricesApi.list(),
      marketplaceParamsApi.listByMarketplace(marketplace.id),
      expensesApi.list(),
      rulesApi.listByMarketplace(marketplace.id),
    ]);

    const productSupplierPrices = supplierPrices.filter((s) => s.productId === previewProductId);
    const marketplaceParams = marketplaceParamsList.find((p) => p.productId === previewProductId);

    const bestSupplierPrice = productSupplierPrices.length ? Math.min(...productSupplierPrices.map((s) => s.price)) : 0;
    const expensesTotal = expenses
      .filter((e) => e.appliesToAll || e.productIds.includes(product.id))
      .reduce((sum, e) => sum + (e.type === "fixed" ? e.value : (e.value / 100) * product.cost), 0);

    const baseContext: ExpressionContext = {
      cost: product.cost,
      brand: product.brand,
      name: product.name,
      externalId: product.externalId,
      ...product.extra,
      bestSupplierPrice,
      supplierPricesCount: productSupplierPrices.length,
      supplierPrice: (supplierName: string) => {
        const needle = String(supplierName ?? "").trim().toLowerCase();
        const matches = productSupplierPrices.filter((s) => s.supplierName.trim().toLowerCase() === needle);
        return matches.length ? Math.min(...matches.map((s) => s.price)) : 0;
      },
      expensesTotal,
      discount: marketplaceParams?.discount ?? 0,
      taxRate: marketplaceParams?.taxRate ?? 0,
      commissionRate: marketplaceParams?.commissionRate ?? 0,
      logistics: marketplaceParams?.logistics ?? 0,
      ads: marketplaceParams?.ads ?? 0,
      otherExpenses: marketplaceParams?.otherExpenses ?? 0,
    };

    const draftId = rule?.id ?? "__draft__";
    const draftRule: Rule = {
      id: draftId,
      marketplaceId: marketplace.id,
      name: name.trim() || "(без имени)",
      priority: Number(priority) || 0,
      enabled,
      conditionMode,
      conditionGroup,
      rawCondition,
      actionScript,
      isFinal,
      schedule: rule?.schedule ?? {},
      createdAt: rule?.createdAt ?? new Date().toISOString(),
    };
    const activeRules = [...savedRules.filter((r) => r.id !== draftId), draftRule]
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    const protectedKeys = protectedContextKeys(product.extra);
    const startPrice = runExpressionScript(marketplace.startPriceScript, baseContext, product.cost, "Начальная цена", warnings);
    let context: ExpressionContext = { ...baseContext, startPrice };

    let matchedThisRule = false;
    let diff: ContextDiffEntry[] = [];
    let searchFrom = 0;

    for (;;) {
      const matchIndex = activeRules.findIndex((r, idx) => {
        if (idx < searchFrom) return false;
        const expr = r.conditionMode === "raw" ? r.rawCondition : conditionGroupToExpression(r.conditionGroup);
        try {
          return evaluateCondition(expr, context);
        } catch {
          return false;
        }
      });
      if (matchIndex === -1) break;

      const matchedRule = activeRules[matchIndex];
      const before = context;
      context = runActionScript(matchedRule.actionScript, context, protectedKeys, matchedRule.name, warnings);
      if (matchedRule.id === draftId) {
        matchedThisRule = true;
        diff = diffContext(before, context);
      }
      if (matchedRule.isFinal) break;
      searchFrom = matchIndex + 1;
    }

    if (!matchedThisRule) {
      setPreviewResult({ matches: false, warnings: warnings.length ? warnings : undefined });
      return;
    }

    const finalStartPrice = Number(context.startPrice);
    const price = runExpressionScript(
      marketplace.priceFormulaScript,
      context,
      Number.isFinite(finalStartPrice) ? finalStartPrice : startPrice,
      "Основная формула",
      warnings,
    );
    const commissionRate = Number(context.commissionRate) || 0;
    const discount = Number(context.discount) || 0;
    const taxRate = Number(context.taxRate) || 0;
    const logistics = Number(context.logistics) || 0;
    const ads = Number(context.ads) || 0;
    const otherExpenses = Number(context.otherExpenses) || 0;
    const netProceeds = price - price * commissionRate - price * (1 - discount) * taxRate - logistics - ads - otherExpenses;
    const marginRatio = price !== 0 ? netProceeds / price : 0;

    setPreviewResult({ matches: true, price, netProceeds, marginRatio, diff, warnings: warnings.length ? warnings : undefined });
  }

  return (
    <Stack>
      <Group grow>
        <TextInput label="Название правила" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <NumberInput label="Приоритет (меньше — выше)" value={priority} onChange={setPriority} />
      </Group>

      <Switch label="Правило активно" checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />

      <div>
        <Switch label="Финальное правило" checked={isFinal} onChange={(e) => setIsFinal(e.currentTarget.checked)} />
        <Text size="xs" c="dimmed" mt={4}>
          {isFinal
            ? "При совпадении условия каскад останавливается на этом правиле — текущее состояние переменных идёт в основную формулу маркетплейса."
            : "При совпадении условия каскад не останавливается: изменения переменных, сделанные этим правилом, сохраняются, и поиск продолжается со следующего подходящего правила (по приоритету)."}
        </Text>
      </div>

      <Alert color="gray" variant="light" title="Переменные, доступные в условии и скрипте действия">
        <Table withRowBorders={false} verticalSpacing={2} fz="xs">
          <Table.Tbody>
            <Table.Tr>
              <Table.Td w={140}>
                <code>cost</code>
              </Table.Td>
              <Table.Td>Себестоимость товара (поле «Себестоимость» в карточке товара)</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>brand</code>, <code>name</code>, <code>externalId</code>
              </Table.Td>
              <Table.Td>Бренд, название и ID товара</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>bestSupplierPrice</code>
              </Table.Td>
              <Table.Td>Минимальная из цен поставщиков этого товара (вкладка «Цены поставщиков»)</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>supplierPricesCount</code>
              </Table.Td>
              <Table.Td>Сколько цен поставщиков указано для товара</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>supplierPrice("Имя")</code>
              </Table.Td>
              <Table.Td>
                Цена конкретного поставщика по имени (как оно указано в «Цены поставщиков»), без учёта регистра. 0, если у товара нет цены от
                такого поставщика.
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>expensesTotal</code>
              </Table.Td>
              <Table.Td>Сумма общих расходов, применимых к товару (вкладка «Расходы»)</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>startPrice</code>
              </Table.Td>
              <Table.Td>
                Стартовая цена, вычисленная скриптом «Стартовая цена» в настройках маркетплейса (или уже изменённая более приоритетными
                правилами каскада). Можно менять и здесь.
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>discount</code>, <code>taxRate</code>, <code>commissionRate</code>, <code>logistics</code>, <code>ads</code>,{" "}
                <code>otherExpenses</code>
              </Table.Td>
              <Table.Td>
                Базовые значения задаются для каждого товара на вкладке маркетплейса «Параметры товаров» (по умолчанию 0). Это переменные —
                скрипт действия этого правила может их менять (см. ниже).
              </Table.Td>
            </Table.Tr>
            {extraKeys.length > 0 && (
              <Table.Tr>
                <Table.Td>
                  {extraKeys.map((k) => (
                    <code key={k}>{k} </code>
                  ))}
                </Table.Td>
                <Table.Td>Ваши «Дополнительные параметры» из карточек товаров (используются в условии как есть)</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Alert>

      <div>
        <Group justify="space-between" mb="xs">
          <Text size="sm" fw={500}>
            Условие
          </Text>
          <Switch
            size="sm"
            label="Сырое выражение"
            checked={conditionMode === "raw"}
            onChange={(e) => setConditionMode(e.currentTarget.checked ? "raw" : "builder")}
          />
        </Group>
        {conditionMode === "builder" ? (
          <ConditionBuilder
            group={conditionGroup}
            onChange={setConditionGroup}
            fieldSuggestions={["cost", "brand", "bestSupplierPrice", "expensesTotal", "startPrice", "discount", "taxRate", "commissionRate"]}
          />
        ) : (
          <ExpressionInput value={rawCondition} onChange={setRawCondition} placeholder='brand == "TIGI" AND cost > 1000' />
        )}
        <Text size="xs" c="dimmed" mt={4}>
          Оставьте пустым, чтобы правило подходило всегда.
        </Text>
      </div>

      <div>
        <Text size="sm" fw={500} mb={4}>
          Скрипт действия (JS)
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          Выполняется при совпадении условия — обычный код на JS, а не выражение. Присваивание вида{" "}
          <code>commissionRate = commissionRate + 0.05;</code> меняет переменную для всех последующих правил каскада и основной формулы
          маркетплейса. <code>discount</code>/<code>taxRate</code>/<code>commissionRate</code> — доли от 1 (0.5 = 50%), поэтому «+5
          процентных пунктов к комиссии» — это <code>commissionRate = commissionRate + 0.05;</code>, а не <code>+ 5</code>. Локальные{" "}
          <code>let</code>/<code>const</code> переменными расчёта не становятся.
        </Text>
        <ScriptInput value={actionScript} onChange={setActionScript} placeholder="commissionRate = commissionRate + 0.05;" />
      </div>

      <div>
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setScheduleOpened((o) => !o)}
          rightSection={scheduleOpened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        >
          Расписание автовкл/выкл{hasActiveSchedule(schedule) ? ` (${WEEK_DAYS.filter((d) => schedule[d]).length} дн.)` : ""}
        </Button>
        <Collapse expanded={scheduleOpened}>
          <Stack gap="xs" mt="xs">
            <Text size="xs" c="dimmed">
              В отмеченные дни правило само включится/выключится в указанное время (по часовому поясу сервера), и цены маркетплейса
              будут пересчитаны автоматически. Ручной переключатель «Правило активно» выше при этом продолжает работать — расписание
              просто переставит его в следующий раз.
            </Text>
            <Stack gap={6}>
              {WEEK_DAYS.map((day) => {
                const entry = schedule[day];
                return (
                  <Group key={day} wrap="nowrap">
                    <Switch
                      checked={!!entry}
                      onChange={(e) => updateScheduleDay(day, e.currentTarget.checked ? {} : null)}
                      label={DAY_LABELS[day]}
                      w={90}
                    />
                    <Select
                      data={[
                        { value: "enable", label: "Включить" },
                        { value: "disable", label: "Выключить" },
                      ]}
                      value={entry?.action ?? "enable"}
                      onChange={(v) => updateScheduleDay(day, { action: (v as RuleScheduleEntry["action"]) ?? "enable" })}
                      disabled={!entry}
                      allowDeselect={false}
                      w={140}
                    />
                    <TextInput
                      type="time"
                      value={entry?.time ?? DEFAULT_SCHEDULE_TIME}
                      onChange={(e) => updateScheduleDay(day, { time: e.currentTarget.value || DEFAULT_SCHEDULE_TIME })}
                      disabled={!entry}
                      w={140}
                    />
                  </Group>
                );
              })}
            </Stack>
          </Stack>
        </Collapse>
      </div>

      <Title order={5} mt="md">
        Проверка на товаре
      </Title>
      <Text size="xs" c="dimmed">
        Проверка подставляет этот черновик правила на его место среди остальных сохранённых правил маркетплейса и считает весь каскад
        (стартовая цена → правила по приоритету → основная формула), как на сервере — без округления и мин/макс цены.
      </Text>
      <Group>
        <Select
          placeholder="Выберите товар"
          data={productOptions}
          value={previewProductId}
          onChange={setPreviewProductId}
          searchable
          style={{ flex: 1 }}
        />
        <Button variant="default" onClick={handlePreview} disabled={!previewProductId} loading={previewing}>
          Рассчитать
        </Button>
      </Group>

      {previewResult && (
        <Alert color={previewResult.error ? "red" : previewResult.matches ? "green" : "gray"}>
          {previewResult.error ? (
            `Ошибка: ${previewResult.error}`
          ) : !previewResult.matches ? (
            "Правило не сработало для этого товара (условие не выполнилось, или каскад остановился на более приоритетном финальном правиле раньше)"
          ) : (
            <Stack gap="xs">
              <Group gap="md">
                <Badge color="indigo">Итоговая цена: {previewResult.price?.toLocaleString("ru-RU")}</Badge>
                {previewResult.netProceeds !== undefined && <Badge color="teal">Выручка: {previewResult.netProceeds.toFixed(2)}</Badge>}
                {previewResult.marginRatio !== undefined && <Badge color="grape">Маржа: {(previewResult.marginRatio * 100).toFixed(1)}%</Badge>}
              </Group>
              {previewResult.diff && previewResult.diff.length > 0 && (
                <Table withRowBorders={false} verticalSpacing={2} fz="xs">
                  <Table.Tbody>
                    {previewResult.diff.map((d) => (
                      <Table.Tr key={d.key}>
                        <Table.Td w={140}>
                          <code>{d.key}</code>
                        </Table.Td>
                        <Table.Td>
                          {String(d.before)} → {String(d.after)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          )}
          {previewResult.warnings?.map((w) => (
            <Text key={w} size="xs" c="orange" mt={4}>
              {w}
            </Text>
          ))}
        </Alert>
      )}

      <Group justify="flex-end" mt="md">
        <Button onClick={handleSubmit} loading={saving}>
          Сохранить правило
        </Button>
      </Group>
    </Stack>
  );
}
