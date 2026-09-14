import { useMemo, useState } from "react";
import { ActionIcon, Alert, Button, FileInput, Group, NumberInput, ScrollArea, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type * as XLSX from "xlsx";
import { readWorkbook, getSheetNames, sheetToMatrix, cellToNumber, cellToString } from "../../utils/excel";
import { db } from "../../db/db";
import { createId } from "../../utils/id";
import type { SupplierPrice } from "../../types";
import { recalcAllMarketplaces } from "../../engine/recalcService";

function colLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

interface SupplierPairMapping {
  id: string;
  priceColumn: string;
  supplierColumn: string;
  defaultSupplierName: string;
}

export function ImportSupplierPricesModal({ onDone }: { onDone: () => void }) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [productIdCol, setProductIdCol] = useState<string | null>(null);
  const [pairs, setPairs] = useState<SupplierPairMapping[]>([]);
  const [importing, setImporting] = useState(false);

  const matrix = useMemo(() => (workbook && sheetName ? sheetToMatrix(workbook, sheetName) : []), [workbook, sheetName]);
  const columnCount = matrix.length ? Math.max(...matrix.slice(0, 20).map((r) => r.length)) : 0;
  const columnOptions = useMemo(
    () =>
      Array.from({ length: columnCount }, (_, i) => ({
        value: String(i),
        label: `${colLabel(i)} — ${cellToString(matrix[headerRow - 1]?.[i]) || "пусто"}`,
      })),
    [columnCount, matrix, headerRow],
  );
  const previewRows = matrix.slice(0, 8);

  function updatePair(index: number, patch: Partial<SupplierPairMapping>) {
    setPairs((p) => p.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    const wb = await readWorkbook(file);
    setWorkbook(wb);
    setSheetName(getSheetNames(wb)[0] ?? null);
  }

  async function handleImport() {
    if (!workbook || !sheetName || productIdCol === null || pairs.length === 0) return;
    setImporting(true);
    try {
      const rows = matrix.slice(headerRow);
      const now = Date.now();
      const products = await db.products.toArray();
      const productByExternalId = new Map(products.map((p) => [p.externalId, p]));

      const records: SupplierPrice[] = [];
      let skipped = 0;

      for (const row of rows) {
        const externalId = cellToString(row[Number(productIdCol)]);
        if (!externalId) continue;
        const product = productByExternalId.get(externalId);
        if (!product) {
          skipped++;
          continue;
        }

        for (const pair of pairs) {
          if (pair.priceColumn === "") continue;
          const price = cellToNumber(row[Number(pair.priceColumn)]);
          if (!price || price <= 0) continue;
          const supplierName =
            (pair.supplierColumn !== "" ? cellToString(row[Number(pair.supplierColumn)]) : "") || pair.defaultSupplierName || "Поставщик";

          records.push({
            id: createId(),
            productId: product.id,
            supplierName,
            price,
            updatedAt: now,
          });
        }
      }

      await db.supplierPrices.bulkAdd(records);
      notifications.show({
        message: `Добавлено цен поставщиков: ${records.length}${skipped ? `, товаров не найдено: ${skipped}` : ""}. Пересчитываем цены...`,
        color: "blue",
      });
      onDone();
      void recalcAllMarketplaces().then(() => notifications.show({ message: "Пересчёт цен после импорта завершён", color: "green" }));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Stack>
      <FileInput
        label="Файл Excel"
        placeholder="Выберите .xlsx файл"
        accept=".xlsx,.xls"
        onChange={handleFile}
        leftSection={<IconUpload size={16} />}
      />

      {workbook && (
        <>
          <Group grow>
            <Select label="Лист" data={getSheetNames(workbook)} value={sheetName} onChange={setSheetName} allowDeselect={false} />
            <NumberInput label="Строка с заголовками" min={1} value={headerRow} onChange={(v) => setHeaderRow(Number(v) || 1)} />
          </Group>

          {previewRows.length > 0 && (
            <ScrollArea.Autosize mah={220}>
              <Table striped withTableBorder>
                <Table.Tbody>
                  {previewRows.map((row, i) => (
                    <Table.Tr key={i} style={i === headerRow - 1 ? { fontWeight: 600 } : undefined}>
                      {row.slice(0, 14).map((cell, j) => (
                        <Table.Td key={j}>{cellToString(cell)}</Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          )}

          <Select label="ID товара (ProductID)" required data={columnOptions} value={productIdCol} onChange={setProductIdCol} searchable />

          <div>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Пары «цена + поставщик»
              </Text>
              <ActionIcon
                variant="subtle"
                onClick={() => setPairs((p) => [...p, { id: createId(), priceColumn: "", supplierColumn: "", defaultSupplierName: "" }])}
                aria-label="Добавить пару"
              >
                <IconPlus size={16} />
              </ActionIcon>
            </Group>
            <Stack gap="xs">
              {pairs.map((pair, index) => (
                <Group key={pair.id} wrap="nowrap">
                  <Select
                    placeholder="колонка цены"
                    style={{ flex: 1 }}
                    data={columnOptions}
                    value={pair.priceColumn || null}
                    onChange={(v) => updatePair(index, { priceColumn: v ?? "" })}
                    searchable
                  />
                  <Select
                    placeholder="колонка поставщика"
                    style={{ flex: 1 }}
                    data={columnOptions}
                    value={pair.supplierColumn || null}
                    onChange={(v) => updatePair(index, { supplierColumn: v ?? "" })}
                    searchable
                    clearable
                  />
                  <TextInput
                    placeholder="имя по умолчанию"
                    style={{ flex: 1 }}
                    value={pair.defaultSupplierName}
                    onChange={(e) => updatePair(index, { defaultSupplierName: e.currentTarget.value })}
                  />
                  <ActionIcon variant="subtle" color="red" onClick={() => setPairs((p) => p.filter((_, i) => i !== index))} aria-label="Удалить">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </div>

          <Alert color="blue" variant="light">
            Формат подходит для отчётов «лучшие предложения» (PriceFirst/PartnerFirst, PriceSecond/PartnerSecond, ...) — добавьте по одной паре
            колонок на каждого поставщика. Строки с пустой или нулевой ценой пропускаются. После импорта цены для всех маркетплейсов
            пересчитаются автоматически.
          </Alert>

          <Group justify="flex-end">
            <Button onClick={handleImport} loading={importing} disabled={productIdCol === null || pairs.length === 0}>
              Импортировать
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
