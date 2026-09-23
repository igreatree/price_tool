import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Group, MultiSelect, NumberInput, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { marketplacesApi } from "../../api/marketplaces";
import { productsApi } from "../../api/products";
import { ExpressionInput } from "../../components/ExpressionInput";
import { ScriptInput } from "../../components/ScriptInput";
import type { Marketplace, RoundingMode } from "../../types";

interface Props {
  marketplace: Marketplace | null;
  onSaved: () => void;
}

const DEFAULT_START_PRICE_SCRIPT = "return cost;";
const DEFAULT_PRICE_FORMULA_SCRIPT = "return startPrice;";

export function MarketplaceForm({ marketplace, onSaved }: Props) {
  const [name, setName] = useState(marketplace?.name ?? "");
  const [roundingMode, setRoundingMode] = useState<RoundingMode>(marketplace?.rounding.mode ?? "nearest");
  const [roundingStep, setRoundingStep] = useState<number | string>(marketplace?.rounding.step ?? 1);
  const [forceEnding, setForceEnding] = useState<number | string>(marketplace?.rounding.forceEnding ?? "");
  const [minPriceFormula, setMinPriceFormula] = useState(marketplace?.minPriceFormula ?? "");
  const [maxPriceFormula, setMaxPriceFormula] = useState(marketplace?.maxPriceFormula ?? "");
  const [excludedProductIds, setExcludedProductIds] = useState<string[]>(marketplace?.excludedProductIds ?? []);
  const [exclusionCondition, setExclusionCondition] = useState(marketplace?.exclusionCondition ?? "");
  const [startPriceScript, setStartPriceScript] = useState(marketplace?.startPriceScript ?? DEFAULT_START_PRICE_SCRIPT);
  const [priceFormulaScript, setPriceFormulaScript] = useState(marketplace?.priceFormulaScript ?? DEFAULT_PRICE_FORMULA_SCRIPT);
  const [saving, setSaving] = useState(false);

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const productOptions = useMemo(() => (products ?? []).map((p) => ({ value: p.id, label: `${p.externalId} — ${p.name}` })), [products]);

  async function handleSubmit() {
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      rounding: {
        mode: roundingMode,
        step: Number(roundingStep) || 1,
        forceEnding: forceEnding === "" ? undefined : Number(forceEnding),
      },
      minPriceFormula: minPriceFormula.trim(),
      maxPriceFormula: maxPriceFormula.trim(),
      excludedProductIds,
      exclusionCondition: exclusionCondition.trim(),
      startPriceScript: startPriceScript.trim() || DEFAULT_START_PRICE_SCRIPT,
      priceFormulaScript: priceFormulaScript.trim() || DEFAULT_PRICE_FORMULA_SCRIPT,
    };
    setSaving(true);
    try {
      if (marketplace) {
        await marketplacesApi.update(marketplace.id, input);
      } else {
        await marketplacesApi.create(input);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack>
      <TextInput
        label="Название маркетплейса"
        required
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder="Ozon, Wildberries, Яндекс Маркет, bagini.shop..."
      />

      <Alert color="gray" variant="light" title="Переменные, доступные в скриптах">
        <Table withRowBorders={false} verticalSpacing={2} fz="xs">
          <Table.Tbody>
            <Table.Tr>
              <Table.Td w={160}>
                <code>cost</code>, <code>brand</code>, <code>name</code>, <code>externalId</code>
              </Table.Td>
              <Table.Td>Себестоимость, бренд, название и ID товара, плюс любые «Дополнительные параметры» из карточки товара</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>bestSupplierPrice</code>, <code>supplierPricesCount</code>, <code>supplierPrice("Имя")</code>
              </Table.Td>
              <Table.Td>Минимальная цена поставщика, число цен поставщиков, цена конкретного поставщика по имени</Table.Td>
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
                Базовые значения с вкладки маркетплейса «Параметры товаров» (доли от 1, по умолчанию 0) — правила могут менять их
                каскадно перед вычислением основной формулы.
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <code>startPrice</code>
              </Table.Td>
              <Table.Td>Только в основной формуле — результат скрипта «Стартовая цена» (или изменённый правилами)</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Alert>

      <div>
        <Text size="sm" fw={500} mb={4}>
          Стартовая цена (JS)
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          Обязателен явный <code>return</code> числа. Определяет, с какой цены начинается расчёт — например, выбор конкретного
          поставщика по бренду.
        </Text>
        <ScriptInput
          value={startPriceScript}
          onChange={setStartPriceScript}
          placeholder={'return brand.toLowerCase().includes("wella") ? supplierPrice("Поставщик1") : cost;'}
        />
      </div>

      <div>
        <Text size="sm" fw={500} mb={4}>
          Основная формула (JS)
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          Обязателен явный <code>return</code> числа. Вычисляет итоговую цену из <code>startPrice</code> и переменных — после того,
          как их, возможно, изменили каскадные правила.
        </Text>
        <ScriptInput
          value={priceFormulaScript}
          onChange={setPriceFormulaScript}
          placeholder="return startPrice / (1 - commissionRate) + logistics + ads + otherExpenses;"
        />
      </div>

      <Group grow align="flex-start">
        <Select
          label="Округление"
          data={[
            { value: "none", label: "Без округления" },
            { value: "nearest", label: "До ближайшего" },
            { value: "up", label: "Вверх" },
            { value: "down", label: "Вниз" },
          ]}
          value={roundingMode}
          onChange={(v) => setRoundingMode((v as RoundingMode) ?? "nearest")}
          allowDeselect={false}
        />
        <NumberInput label="Шаг округления" min={0} value={roundingStep} onChange={setRoundingStep} />
        <NumberInput label="Психологическое окончание (напр. 9, 99)" value={forceEnding} onChange={setForceEnding} placeholder="необязательно" />
      </Group>

      <ExpressionInput
        label="Формула минимальной цены (необязательно)"
        placeholder="cost + expensesTotal + 100"
        value={minPriceFormula}
        onChange={setMinPriceFormula}
      />
      <ExpressionInput label="Формула максимальной цены (необязательно)" placeholder="10000" value={maxPriceFormula} onChange={setMaxPriceFormula} />

      <div>
        <Text size="sm" fw={500} mb={4}>
          Исключения из автоперерасчёта цены
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          Цена этих товаров не будет меняться при пересчёте (вручную или автоматически после правок) для этого маркетплейса — в таблице
          «Расчёт цен» они помечаются предупреждением «исключён».
        </Text>
        <Stack gap="xs">
          <MultiSelect
            label="Исключённые товары"
            placeholder="Выберите товары"
            data={productOptions}
            value={excludedProductIds}
            onChange={setExcludedProductIds}
            searchable
            clearable
          />
          <ExpressionInput
            label="Условие исключения (необязательно)"
            placeholder='brand == "Discontinued"'
            value={exclusionCondition}
            onChange={setExclusionCondition}
          />
        </Stack>
      </div>

      <Group justify="flex-end" mt="md">
        <Button onClick={handleSubmit} loading={saving}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
