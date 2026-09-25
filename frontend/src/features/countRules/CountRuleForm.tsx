import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Group, NumberInput, Select, Stack, Switch, Table, Text, TextInput, Title } from "@mantine/core";
import { productsApi } from "../../api/products";
import { supplierPricesApi } from "../../api/supplierPrices";
import { marketplaceParamsApi } from "../../api/marketplaceParams";
import { expensesApi } from "../../api/expenses";
import { countRulesApi } from "../../api/countRules";
import type { ConditionGroup, CountRule, Marketplace } from "../../types";
import { ConditionBuilder } from "../rules/ConditionBuilder";
import { ExpressionInput } from "../../components/ExpressionInput";
import { ScriptInput } from "../../components/ScriptInput";
import { conditionGroupToExpression, emptyConditionGroup } from "../../engine/conditionBuilder";
import { evaluateCondition, type ExpressionContext } from "../../engine/expression";
import { runExpressionScript } from "../../engine/js-script";

interface Props {
  marketplace: Marketplace;
  rule: CountRule | null;
  onSaved: () => void;
}

interface PreviewResult {
  matches: boolean;
  /** Остаток на конец всего каскада (то, что реально сохранится). */
  count?: number;
  /** Что вернул скрипт именно этого правила — отличается от count, если после него каскад
   * продолжился другими (не финальными) правилами. */
  ownCount?: number;
  warnings?: string[];
  error?: string;
}

export function CountRuleForm({ marketplace, rule, onSaved }: Props) {
  const [name, setName] = useState(rule?.name ?? "");
  const [priority, setPriority] = useState<number | string>(rule?.priority ?? 100);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [conditionMode, setConditionMode] = useState<CountRule["conditionMode"]>(rule?.conditionMode ?? "builder");
  const [conditionGroup, setConditionGroup] = useState<ConditionGroup>(rule?.conditionGroup ?? emptyConditionGroup());
  const [rawCondition, setRawCondition] = useState(rule?.rawCondition ?? "");
  const [script, setScript] = useState(rule?.script ?? "");
  const [isFinal, setIsFinal] = useState(rule?.isFinal ?? true);

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

  async function handleSubmit() {
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      priority: Number(priority) || 0,
      enabled,
      conditionMode,
      conditionGroup,
      rawCondition,
      script: script.trim(),
      isFinal,
    };
    setSaving(true);
    try {
      if (rule) {
        await countRulesApi.update(rule.id, input);
      } else {
        await countRulesApi.create(marketplace.id, input);
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

  /** Подставляет этот черновик правила на его место среди остальных сохранённых правил остатков и
   * считает весь каскад (правила по приоритету, каждое видит prevCount — результат предыдущего
   * неполного правила), как на сервере (backend/src/pricing/calculate-count.ts). */
  async function runPreview() {
    if (!previewProductId) return;
    const warnings: string[] = [];
    const [product, supplierPrices, marketplaceParamsList, expenses, savedRules] = await Promise.all([
      productsApi.get(previewProductId),
      supplierPricesApi.list(),
      marketplaceParamsApi.listByMarketplace(marketplace.id),
      expensesApi.list(),
      countRulesApi.listByMarketplace(marketplace.id),
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
      supplierData: productSupplierPrices.map((s) => ({ name: s.supplierName, price: s.price, count: s.count })),
      expensesTotal,
      discount: marketplaceParams?.discount ?? 0,
      taxRate: marketplaceParams?.taxRate ?? 0,
      commissionRate: marketplaceParams?.commissionRate ?? 0,
      logistics: marketplaceParams?.logistics ?? 0,
      ads: marketplaceParams?.ads ?? 0,
      otherExpenses: marketplaceParams?.otherExpenses ?? 0,
    };

    const draftId = rule?.id ?? "__draft__";
    const draftRule: CountRule = {
      id: draftId,
      marketplaceId: marketplace.id,
      name: name.trim() || "(без имени)",
      priority: Number(priority) || 0,
      enabled,
      conditionMode,
      conditionGroup,
      rawCondition,
      script,
      isFinal,
      createdAt: rule?.createdAt ?? new Date().toISOString(),
    };
    const activeRules = [...savedRules.filter((r) => r.id !== draftId), draftRule]
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    let count = 0;
    let matchedThisRule = false;
    let ownCount: number | undefined;
    let searchFrom = 0;

    for (;;) {
      const matchIndex = activeRules.findIndex((r, idx) => {
        if (idx < searchFrom) return false;
        const expr = r.conditionMode === "raw" ? r.rawCondition : conditionGroupToExpression(r.conditionGroup);
        try {
          return evaluateCondition(expr, { ...context, prevCount: count });
        } catch {
          return false;
        }
      });
      if (matchIndex === -1) break;

      const matchedRule = activeRules[matchIndex];
      count = runExpressionScript(matchedRule.script, { ...context, prevCount: count }, count, matchedRule.name, warnings);
      if (matchedRule.id === draftId) {
        matchedThisRule = true;
        ownCount = count;
      }
      if (matchedRule.isFinal) break;
      searchFrom = matchIndex + 1;
    }

    if (!matchedThisRule) {
      setPreviewResult({ matches: false, warnings: warnings.length ? warnings : undefined });
      return;
    }

    setPreviewResult({ matches: true, count, ownCount, warnings: warnings.length ? warnings : undefined });
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
            ? "При совпадении условия каскад останавливается на этом правиле — его результат и есть итоговый остаток."
            : "При совпадении условия каскад не останавливается: результат этого правила передаётся дальше как prevCount следующему подходящему правилу (по приоритету)."}
        </Text>
      </div>

      <Alert color="gray" variant="light" title="Переменные, доступные в условии и скрипте">
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
                <code>supplierData</code>
              </Table.Td>
              <Table.Td>
                Массив цен и остатков всех поставщиков товара:{" "}
                <code>
                  [{"{"}name: "Поставщик1", price: 500, count: 30{"}"}, {"{"}name: "Поставщик2", price: 400, count: 12{"}"}]
                </code>
                .
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
                <code>prevCount</code>
              </Table.Td>
              <Table.Td>
                Остаток, посчитанный предыдущим неполным правилом в цепочке (0, если это первое сработавшее правило). Работает только
                если более приоритетное подошедшее правило помечено не финальным — см. переключатель «Финальное правило» выше.
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
            {extraKeys.length > 0 && (
              <Table.Tr>
                <Table.Td>
                  {extraKeys.map((k) => (
                    <code key={k}>{k} </code>
                  ))}
                </Table.Td>
                <Table.Td>Ваши «Дополнительные параметры» из карточек товаров (используются в условии/скрипте как есть)</Table.Td>
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
            fieldSuggestions={["cost", "brand", "bestSupplierPrice", "expensesTotal", "prevCount", "discount", "taxRate", "commissionRate"]}
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
          Скрипт (JS)
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          Выполняется при совпадении условия — обязателен явный <code>return</code> числа: это и есть остаток товара. Может учитывать{" "}
          <code>prevCount</code> и данные поставщиков, например{" "}
          <code>return supplierData.reduce((sum, s) =&gt; sum + s.count, 0);</code>.
        </Text>
        <ScriptInput value={script} onChange={setScript} placeholder="return supplierData.reduce((sum, s) => sum + s.count, 0);" />
      </div>

      <Title order={5} mt="md">
        Проверка на товаре
      </Title>
      <Text size="xs" c="dimmed">
        Проверка подставляет этот черновик правила на его место среди остальных сохранённых правил остатков и считает весь каскад по
        приоритету, как на сервере.
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
            <Group gap="md">
              <Badge color="indigo">Остаток (итог каскада): {previewResult.count}</Badge>
              {previewResult.ownCount !== undefined && previewResult.ownCount !== previewResult.count && (
                <Badge color="grape">Результат этого правила: {previewResult.ownCount}</Badge>
              )}
            </Group>
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
