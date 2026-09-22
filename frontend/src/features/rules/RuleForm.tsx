import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Collapse, Group, NumberInput, Select, Stack, Switch, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { productsApi } from "../../api/products";
import { supplierPricesApi } from "../../api/supplierPrices";
import { marketplaceParamsApi } from "../../api/marketplaceParams";
import { expensesApi } from "../../api/expenses";
import { rulesApi } from "../../api/rules";
import type { ConditionGroup, Marketplace, PricingMode, Rule, RuleSchedule, RuleScheduleEntry, WeekDay } from "../../types";
import { ConditionBuilder } from "./ConditionBuilder";
import { ExpressionInput } from "../../components/ExpressionInput";
import { conditionGroupToExpression, emptyConditionGroup } from "../../engine/conditionBuilder";
import { evaluateCondition, evaluateFormula, type ExpressionContext } from "../../engine/expression";
import { solvePrice } from "../../engine/solver";
import { DAY_LABELS, DEFAULT_SCHEDULE_TIME, WEEK_DAYS, hasActiveSchedule } from "./ruleSchedule";

interface Props {
  marketplace: Marketplace;
  rule: Rule | null;
  onSaved: () => void;
}

interface PreviewResult {
  matches: boolean;
  price?: number;
  netProceeds?: number;
  marginRatio?: number;
  iterations?: number;
  error?: string;
}

export function RuleForm({ marketplace, rule, onSaved }: Props) {
  const [name, setName] = useState(rule?.name ?? "");
  const [priority, setPriority] = useState<number | string>(rule?.priority ?? 100);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [conditionMode, setConditionMode] = useState<Rule["conditionMode"]>(rule?.conditionMode ?? "builder");
  const [conditionGroup, setConditionGroup] = useState<ConditionGroup>(rule?.conditionGroup ?? emptyConditionGroup());
  const [rawCondition, setRawCondition] = useState(rule?.rawCondition ?? "");
  const [formula, setFormula] = useState(rule?.formula ?? "");
  const [isFinal, setIsFinal] = useState(rule?.isFinal ?? true);
  const [priceModeOverride, setPriceModeOverride] = useState<PricingMode | null>(rule?.priceMode ?? null);
  const [postScript, setPostScript] = useState(rule?.postScript ?? "");
  const [scriptOpened, setScriptOpened] = useState(!!rule?.postScript);
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

  const conditionExpr = conditionMode === "raw" ? rawCondition : conditionGroupToExpression(conditionGroup);
  const effectiveMode: PricingMode = priceModeOverride ?? marketplace.pricingMode;

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
      formula: formula.trim(),
      postScript: postScript.trim() || undefined,
      isFinal,
      schedule,
      priceMode: priceModeOverride,
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

  async function runPreview() {
    if (!previewProductId) return;
    const [product, supplierPrices, marketplaceParamsList, expenses] = await Promise.all([
      productsApi.get(previewProductId),
      supplierPricesApi.list(),
      marketplaceParamsApi.listByMarketplace(marketplace.id),
      expensesApi.list(),
    ]);

    const productSupplierPrices = supplierPrices.filter((s) => s.productId === previewProductId);
    const marketplaceParams = marketplaceParamsList.find((p) => p.productId === previewProductId);

    const bestSupplierPrice = productSupplierPrices.length ? Math.min(...productSupplierPrices.map((s) => s.price)) : 0;
    const expensesTotal = expenses
      .filter((e) => e.appliesToAll || e.productIds.includes(product.id))
      .reduce((sum, e) => sum + (e.type === "fixed" ? e.value : (e.value / 100) * product.cost), 0);

    const context: ExpressionContext = {
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
      prevPrice: 0,
      discount: marketplaceParams?.discount ?? 0,
      taxRate: marketplaceParams?.taxRate ?? 0,
      commissionRate: marketplaceParams?.commissionRate ?? 0,
      logistics: marketplaceParams?.logistics ?? 0,
      ads: marketplaceParams?.ads ?? 0,
      otherExpenses: marketplaceParams?.otherExpenses ?? 0,
    };

    try {
      const matches = evaluateCondition(conditionExpr, context);
      if (!matches) {
        setPreviewResult({ matches: false });
        return;
      }
      if (effectiveMode === "direct") {
        const price = evaluateFormula(formula, context);
        setPreviewResult({ matches: true, price });
      } else {
        const solved = solvePrice(
          (candidatePrice) => evaluateFormula(formula, { ...context, price: candidatePrice }),
          product.cost,
          marketplace.solver,
        );
        setPreviewResult({
          matches: true,
          price: solved.price,
          netProceeds: solved.netProceeds,
          marginRatio: solved.marginRatio,
          iterations: solved.iterations,
        });
      }
    } catch (e) {
      setPreviewResult({ matches: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <Stack>
      <Group grow>
        <TextInput label="Название правила" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <NumberInput label="Приоритет (меньше — выше)" value={priority} onChange={setPriority} />
      </Group>

      <Switch label="Правило активно" checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />

      <div>
        <Switch
          label="Финальное правило"
          checked={isFinal}
          onChange={(e) => setIsFinal(e.currentTarget.checked)}
        />
        <Text size="xs" c="dimmed" mt={4}>
          {isFinal
            ? "При совпадении условия это правило сразу определяет цену."
            : "При совпадении условия расчёт не останавливается: цена этого правила передаётся дальше как prevPrice следующему подходящему правилу (по приоритету)."}
        </Text>
      </div>

      <div>
        <Select
          label="Режим цены для этого правила"
          data={[
            { value: "", label: `Как у маркетплейса (${marketplace.pricingMode === "direct" ? "прямая формула" : "целевая маржа"})` },
            { value: "direct", label: "Прямая формула (формула сразу считает цену)" },
            { value: "targetMargin", label: "Целевая маржа (формула считает выручку, цена подбирается)" },
          ]}
          value={priceModeOverride ?? ""}
          onChange={(v) => setPriceModeOverride(v ? (v as PricingMode) : null)}
          allowDeselect={false}
        />
        <Text size="xs" c="dimmed" mt={4}>
          По умолчанию правило считает цену так же, как настроено для всего маркетплейса. Переопределите здесь, если именно этому
          правилу нужно задавать цену напрямую (или наоборот — считать через целевую маржу) вне зависимости от общей настройки.
        </Text>
      </div>

      <Alert color="gray" variant="light" title="Переменные, доступные в условии и формуле">
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
                такого поставщика — например, условие <code>supplierPrice("Ozon Wholesale") &gt; 0</code> сработает только если у товара есть
                цена именно от этого поставщика, а формула может использовать <code>supplierPrice("Ozon Wholesale") * 1.3</code> вместо{" "}
                <code>bestSupplierPrice</code>.
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
                <code>prevPrice</code>
              </Table.Td>
              <Table.Td>
                Цена, посчитанная предыдущим правилом в цепочке (0, если это первое сработавшее правило). Работает только если более
                приоритетное подошедшее правило помечено не финальным — см. переключатель «Финальное правило» ниже.
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>discount</code>, <code>taxRate</code>, <code>commissionRate</code>, <code>logistics</code>, <code>ads</code>,{" "}
                <code>otherExpenses</code>
              </Table.Td>
              <Table.Td>
                Задаются для каждого товара на вкладке маркетплейса «Параметры товаров» — не в карточке товара. По умолчанию 0.
              </Table.Td>
            </Table.Tr>
            {effectiveMode === "targetMargin" && (
              <Table.Tr>
                <Table.Td>
                  <code>price</code>
                </Table.Td>
                <Table.Td>
                  Только в формуле чистой выручки: цена, которую подбирает решатель. Формула описывает выручку <em>как функцию от price</em>, а
                  не саму цену.
                </Table.Td>
              </Table.Tr>
            )}
            {extraKeys.length > 0 && (
              <Table.Tr>
                <Table.Td>
                  {extraKeys.map((k) => (
                    <code key={k}>{k} </code>
                  ))}
                </Table.Td>
                <Table.Td>Ваши «Дополнительные параметры» из карточек товаров (используются в условиях/формулах как есть)</Table.Td>
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
            fieldSuggestions={["cost", "brand", "bestSupplierPrice", "expensesTotal", "prevPrice", "discount", "taxRate", "commissionRate"]}
          />
        ) : (
          <ExpressionInput value={rawCondition} onChange={setRawCondition} placeholder='brand == "TIGI" AND cost > 1000' />
        )}
        <Text size="xs" c="dimmed" mt={4}>
          Оставьте пустым, чтобы правило подходило всегда.
        </Text>
      </div>

      <ExpressionInput
        label={effectiveMode === "direct" ? "Формула цены" : "Формула чистой выручки от price"}
        placeholder={
          effectiveMode === "direct"
            ? "cost * 1.4"
            : "price - price*commissionRate - price*(1-discount)*taxRate - logistics - ads - otherExpenses"
        }
        value={formula}
        onChange={setFormula}
        required
      />

      <div>
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setScriptOpened((o) => !o)}
          rightSection={scriptOpened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        >
          Продвинутое: пользовательский скрипт (JS)
        </Button>
        <Collapse expanded={scriptOpened}>
          <Stack gap="xs" mt="xs">
            <Text size="xs" c="dimmed">
              Выполняется после формулы, до проверки мин/макс цены. Доступны переменные <code>ctx</code> (контекст товара) и{" "}
              <code>price</code>. Должен вернуть новое число цены.
            </Text>
            <Textarea value={postScript} onChange={(e) => setPostScript(e.currentTarget.value)} placeholder="return price * 0.99;" autosize minRows={3} />
          </Stack>
        </Collapse>
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
        Проверка считает только это правило изолированно: <code>prevPrice</code> здесь всегда 0, даже если правило каскадное.
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
            "Условие не выполняется для этого товара"
          ) : (
            <Group gap="md">
              <Badge color="indigo">Цена: {previewResult.price?.toLocaleString("ru-RU")}</Badge>
              {previewResult.netProceeds !== undefined && <Badge color="teal">Выручка: {previewResult.netProceeds.toFixed(2)}</Badge>}
              {previewResult.marginRatio !== undefined && <Badge color="grape">X: {previewResult.marginRatio.toFixed(3)}</Badge>}
              {previewResult.iterations !== undefined && <Badge color="gray">Итераций: {previewResult.iterations}</Badge>}
            </Group>
          )}
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
