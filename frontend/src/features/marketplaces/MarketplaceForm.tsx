import { useState } from "react";
import { Button, Group, NumberInput, SegmentedControl, Select, Stack, Text, TextInput } from "@mantine/core";
import { marketplacesApi } from "../../api/marketplaces";
import { ExpressionInput } from "../../components/ExpressionInput";
import type { Marketplace, RoundingMode, SolverConfig } from "../../types";

interface Props {
  marketplace: Marketplace | null;
  onSaved: () => void;
}

const DEFAULT_SOLVER: SolverConfig = { minX: 1.2, maxX: 1.3, searchMultiplierMin: 0.5, searchMultiplierMax: 10, maxIterations: 200 };

export function MarketplaceForm({ marketplace, onSaved }: Props) {
  const [name, setName] = useState(marketplace?.name ?? "");
  const [pricingMode, setPricingMode] = useState<Marketplace["pricingMode"]>(marketplace?.pricingMode ?? "direct");
  const [roundingMode, setRoundingMode] = useState<RoundingMode>(marketplace?.rounding.mode ?? "nearest");
  const [roundingStep, setRoundingStep] = useState<number | string>(marketplace?.rounding.step ?? 1);
  const [forceEnding, setForceEnding] = useState<number | string>(marketplace?.rounding.forceEnding ?? "");
  const [minPriceFormula, setMinPriceFormula] = useState(marketplace?.minPriceFormula ?? "");
  const [maxPriceFormula, setMaxPriceFormula] = useState(marketplace?.maxPriceFormula ?? "");
  const [solver, setSolver] = useState<SolverConfig>(marketplace?.solver ?? DEFAULT_SOLVER);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      pricingMode,
      rounding: {
        mode: roundingMode,
        step: Number(roundingStep) || 1,
        forceEnding: forceEnding === "" ? undefined : Number(forceEnding),
      },
      minPriceFormula: minPriceFormula.trim(),
      maxPriceFormula: maxPriceFormula.trim(),
      solver,
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

      <div>
        <Text size="sm" fw={500} mb={4}>
          Режим ценообразования
        </Text>
        <SegmentedControl
          fullWidth
          value={pricingMode}
          onChange={(v) => setPricingMode(v as Marketplace["pricingMode"])}
          data={[
            { label: "Прямая формула", value: "direct" },
            { label: "Целевая маржа (подбор цены)", value: "targetMargin" },
          ]}
        />
        <Text size="xs" c="dimmed" mt={4}>
          {pricingMode === "direct"
            ? "Формула правила сразу вычисляет цену, например cost * 1.4."
            : "Формула правила описывает чистую выручку как функцию от price; цена подбирается так, чтобы отношение выручка/себестоимость попало в диапазон Мин.X–Макс.X."}
        </Text>
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

      {pricingMode === "targetMargin" && (
        <>
          <Text size="sm" fw={500}>
            Параметры подбора цены (аналог листа «Настройки»)
          </Text>
          <Group grow>
            <NumberInput
              label="Мин. X"
              decimalScale={3}
              step={0.01}
              value={solver.minX}
              onChange={(v) => setSolver((s) => ({ ...s, minX: Number(v) || 0 }))}
            />
            <NumberInput
              label="Макс. X"
              decimalScale={3}
              step={0.01}
              value={solver.maxX}
              onChange={(v) => setSolver((s) => ({ ...s, maxX: Number(v) || 0 }))}
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Мин. множитель поиска (× себестоимость)"
              decimalScale={2}
              value={solver.searchMultiplierMin}
              onChange={(v) => setSolver((s) => ({ ...s, searchMultiplierMin: Number(v) || 0 }))}
            />
            <NumberInput
              label="Макс. множитель поиска (× себестоимость)"
              decimalScale={2}
              value={solver.searchMultiplierMax}
              onChange={(v) => setSolver((s) => ({ ...s, searchMultiplierMax: Number(v) || 0 }))}
            />
          </Group>
          <NumberInput
            label="Макс. итераций"
            min={1}
            value={solver.maxIterations}
            onChange={(v) => setSolver((s) => ({ ...s, maxIterations: Number(v) || 1 }))}
          />
        </>
      )}

      <Group justify="flex-end" mt="md">
        <Button onClick={handleSubmit} loading={saving}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
