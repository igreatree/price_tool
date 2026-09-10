import { useMemo, useState } from "react";
import { Alert, Button, FileInput, Group, NumberInput, ScrollArea, Select, SimpleGrid, Stack, Table } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type * as XLSX from "xlsx";
import { readWorkbook, getSheetNames, sheetToMatrix, cellToNumber, cellToString } from "../../utils/excel";
import { db } from "../../db/db";
import { createId } from "../../utils/id";
import type { Marketplace, MarketplaceProductParams } from "../../types";
import { recalcMarketplace } from "../../engine/recalcService";

function colLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

type NumericField = "discount" | "taxRate" | "commissionRate" | "logistics" | "ads" | "otherExpenses";

const FIELDS: { key: NumericField; label: string }[] = [
  { key: "discount", label: "Скидка (СПП)" },
  { key: "taxRate", label: "Налог" },
  { key: "commissionRate", label: "Комиссия" },
  { key: "logistics", label: "Логистика, ₽" },
  { key: "ads", label: "Реклама, ₽" },
  { key: "otherExpenses", label: "Доп. расходы, ₽" },
];

export function ImportMarketplaceParamsModal({ marketplace, onDone }: { marketplace: Marketplace; onDone: () => void }) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [productIdCol, setProductIdCol] = useState<string | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<Record<NumericField, string | null>>>({});
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

  async function handleFile(file: File | null) {
    if (!file) return;
    const wb = await readWorkbook(file);
    setWorkbook(wb);
    setSheetName(getSheetNames(wb)[0] ?? null);
  }

  async function handleImport() {
    if (!workbook || !sheetName || productIdCol === null) return;
    setImporting(true);
    try {
      const rows = matrix.slice(headerRow);
      const now = Date.now();
      const products = await db.products.toArray();
      const productByExternalId = new Map(products.map((p) => [p.externalId, p]));
      const existingParams = await db.marketplaceProductParams.where("marketplaceId").equals(marketplace.id).toArray();
      const existingByProductId = new Map(existingParams.map((p) => [p.productId, p]));

      const records: MarketplaceProductParams[] = [];
      let skipped = 0;

      for (const row of rows) {
        const externalId = cellToString(row[Number(productIdCol)]);
        if (!externalId) continue;
        const product = productByExternalId.get(externalId);
        if (!product) {
          skipped++;
          continue;
        }

        const existing = existingByProductId.get(product.id);
        const record: MarketplaceProductParams = {
          id: existing?.id ?? createId(),
          productId: product.id,
          marketplaceId: marketplace.id,
          discount: existing?.discount ?? 0,
          taxRate: existing?.taxRate ?? 0,
          commissionRate: existing?.commissionRate ?? 0,
          logistics: existing?.logistics ?? 0,
          ads: existing?.ads ?? 0,
          otherExpenses: existing?.otherExpenses ?? 0,
          updatedAt: now,
        };
        for (const field of FIELDS) {
          const col = columnMap[field.key];
          if (col) {
            record[field.key] = cellToNumber(row[Number(col)]);
          }
        }
        records.push(record);
      }

      await db.marketplaceProductParams.bulkPut(records);
      notifications.show({
        message: `Обновлено параметров: ${records.length}${skipped ? `, товаров не найдено: ${skipped}` : ""}. Пересчитываем цены...`,
        color: "blue",
      });
      onDone();
      void recalcMarketplace(marketplace).then(() => notifications.show({ message: "Пересчёт цен завершён", color: "green" }));
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

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {FIELDS.map((field) => (
              <Select
                key={field.key}
                label={field.label}
                data={columnOptions}
                value={columnMap[field.key] ?? null}
                onChange={(v) => setColumnMap((m) => ({ ...m, [field.key]: v }))}
                searchable
                clearable
              />
            ))}
          </SimpleGrid>

          <Alert color="blue" variant="light">
            Не сопоставленные поля не изменяются у уже существующих записей. После импорта цены для этого маркетплейса пересчитаются
            автоматически.
          </Alert>

          <Group justify="flex-end">
            <Button onClick={handleImport} loading={importing} disabled={productIdCol === null}>
              Импортировать
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
