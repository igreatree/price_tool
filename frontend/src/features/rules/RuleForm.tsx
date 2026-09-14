import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Collapse, Group, NumberInput, Select, Stack, Switch, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { productsApi } from "../../api/products";
import { supplierPricesApi } from "../../api/supplierPrices";
import { marketplaceParamsApi } from "../../api/marketplaceParams";
import { expensesApi } from "../../api/expenses";
import { rulesApi } from "../../api/rules";
import type { ConditionGroup, Marketplace, Rule } from "../../types";
import { ConditionBuilder } from "./ConditionBuilder";
import { ExpressionInput } from "../../components/ExpressionInput";
import { conditionGroupToExpression, emptyConditionGroup } from "../../engine/conditionBuilder";
import { evaluateCondition, evaluateFormula, type ExpressionContext } from "../../engine/expression";
import { solvePrice } from "../../engine/solver";

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
  const [postScript, setPostScript] = useState(rule?.postScript ?? "");
  const [scriptOpened, setScriptOpened] = useState(!!rule?.postScript);

  const [previewProductId, setPreviewProductId] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

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
    };
    if (rule) {
      await rulesApi.update(rule.id, input);
    } else {
      await rulesApi.create(marketplace.id, input);
    }
    onSaved();
  }

  async function handlePreview() {
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
      expensesTotal,
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
      if (marketplace.pricingMode === "direct") {
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
                <code>expensesTotal</code>
              </Table.Td>
              <Table.Td>Сумма общих расходов, применимых к товару (вкладка «Расходы»)</Table.Td>
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
            {marketplace.pricingMode === "targetMargin" && (
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
            fieldSuggestions={["cost", "brand", "bestSupplierPrice", "expensesTotal", "discount", "taxRate", "commissionRate"]}
          />
        ) : (
          <ExpressionInput value={rawCondition} onChange={setRawCondition} placeholder='brand == "TIGI" AND cost > 1000' />
        )}
        <Text size="xs" c="dimmed" mt={4}>
          Оставьте пустым, чтобы правило подходило всегда.
        </Text>
      </div>

      <ExpressionInput
        label={marketplace.pricingMode === "direct" ? "Формула цены" : "Формула чистой выручки от price"}
        placeholder={
          marketplace.pricingMode === "direct"
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

      <Title order={5} mt="md">
        Проверка на товаре
      </Title>
      <Group>
        <Select
          placeholder="Выберите товар"
          data={productOptions}
          value={previewProductId}
          onChange={setPreviewProductId}
          searchable
          style={{ flex: 1 }}
        />
        <Button variant="default" onClick={handlePreview} disabled={!previewProductId}>
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
        <Button onClick={handleSubmit}>Сохранить правило</Button>
      </Group>
    </Stack>
  );
}
