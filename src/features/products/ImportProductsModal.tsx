import { useMemo, useState } from "react";
import { ActionIcon, Alert, Button, FileInput, Group, NumberInput, ScrollArea, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type * as XLSX from "xlsx";
import { readWorkbook, getSheetNames, sheetToMatrix, cellToNumber, cellToString } from "../../utils/excel";
import { db } from "../../db/db";
import { createId } from "../../utils/id";
import type { Product } from "../../types";
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

interface ExtraMapping {
  id: string;
  key: string;
  column: string;
}

export function ImportProductsModal({ onDone }: { onDone: () => void }) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [externalIdCol, setExternalIdCol] = useState<string | null>(null);
  const [nameCol, setNameCol] = useState<string | null>(null);
  const [costCol, setCostCol] = useState<string | null>(null);
  const [brandCol, setBrandCol] = useState<string | null>(null);
  const [extraMappings, setExtraMappings] = useState<ExtraMapping[]>([]);
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
    if (!workbook || !sheetName || externalIdCol === null || nameCol === null || costCol === null) return;
    setImporting(true);
    try {
      const rows = matrix.slice(headerRow);
      const now = Date.now();
      const existingByExternalId = new Map((await db.products.toArray()).map((p) => [p.externalId, p]));

      const records: Product[] = [];
      for (const row of rows) {
        const externalId = cellToString(row[Number(externalIdCol)]);
        if (!externalId) continue;
        const name = cellToString(row[Number(nameCol)]);
        const cost = cellToNumber(row[Number(costCol)]);
        const brand = brandCol !== null ? cellToString(row[Number(brandCol)]) : "";

        const extra: Record<string, string | number> = {};
        for (const mapping of extraMappings) {
          if (!mapping.key.trim() || mapping.column === "") continue;
          const raw = row[Number(mapping.column)];
          const str = cellToString(raw);
          const num = cellToNumber(raw);
          extra[mapping.key.trim()] = str !== "" && Number.isFinite(num) && String(num) === str ? num : str;
        }

        const existing = existingByExternalId.get(externalId);
        records.push({
          id: existing?.id ?? createId(),
          externalId,
          name,
          brand,
          cost,
          extra,
          updatedAt: now,
        });
      }

      await db.products.bulkPut(records);
      notifications.show({ message: `Импортировано товаров: ${records.length}. Пересчитываем цены...`, color: "blue" });
      onDone();
      void recalcAllMarketplaces().then(() => notifications.show({ message: "Пересчёт цен после импорта завершён", color: "green" }));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Stack>
      <FileInput label="Файл Excel" placeholder="Выберите .xlsx файл" accept=".xlsx,.xls" onChange={handleFile} leftSection={<IconUpload size={16} />} />

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
                      {row.slice(0, 12).map((cell, j) => (
                        <Table.Td key={j}>{cellToString(cell)}</Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          )}

          <Group grow>
            <Select label="ID товара" required data={columnOptions} value={externalIdCol} onChange={setExternalIdCol} searchable />
            <Select label="Название" required data={columnOptions} value={nameCol} onChange={setNameCol} searchable />
          </Group>
          <Group grow>
            <Select label="Себестоимость" required data={columnOptions} value={costCol} onChange={setCostCol} searchable />
            <Select label="Бренд" data={columnOptions} value={brandCol} onChange={setBrandCol} searchable clearable />
          </Group>

          <div>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Дополнительные параметры
              </Text>
              <ActionIcon
                variant="subtle"
                onClick={() => setExtraMappings((m) => [...m, { id: createId(), key: "", column: "" }])}
                aria-label="Добавить параметр"
              >
                <IconPlus size={16} />
              </ActionIcon>
            </Group>
            <Stack gap="xs">
              {extraMappings.map((mapping, index) => (
                <Group key={mapping.id} wrap="nowrap">
                  <TextInput
                    placeholder="ключ, напр. size"
                    style={{ flex: 1 }}
                    value={mapping.key}
                    onChange={(e) => setExtraMappings((m) => m.map((it, i) => (i === index ? { ...it, key: e.currentTarget.value } : it)))}
                  />
                  <Select
                    placeholder="колонка"
                    style={{ flex: 1 }}
                    data={columnOptions}
                    value={mapping.column || null}
                    onChange={(v) => setExtraMappings((m) => m.map((it, i) => (i === index ? { ...it, column: v ?? "" } : it)))}
                    searchable
                  />
                  <ActionIcon variant="subtle" color="red" onClick={() => setExtraMappings((m) => m.filter((_, i) => i !== index))} aria-label="Удалить">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </div>

          <Alert color="blue" variant="light">
            Импорт находит товар по «ID товара»: если товар с таким ID уже есть — данные обновятся, иначе создастся новый. После импорта цены
            для всех маркетплейсов пересчитаются автоматически.
          </Alert>

          <Group justify="flex-end">
            <Button onClick={handleImport} loading={importing} disabled={externalIdCol === null || nameCol === null || costCol === null}>
              Импортировать
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
