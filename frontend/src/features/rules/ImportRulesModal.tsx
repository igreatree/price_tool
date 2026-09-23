import { useMemo, useState } from "react";
import { Alert, Button, FileInput, Group, ScrollArea, Select, Stack, Table, Text } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type * as XLSX from "xlsx";
import { readWorkbook, getSheetNames, sheetToObjects, cellToString, cellToNumber, cellToBoolean } from "../../utils/excel";
import { rulesApi, type RuleImportRow } from "../../api/rules";
import type { Marketplace } from "../../types";
import { RULE_SHEET_COLUMNS } from "./ruleSheetColumns";

function getCell(row: Record<string, unknown>, expectedHeader: string): unknown {
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === expectedHeader.trim().toLowerCase());
  return key ? row[key] : undefined;
}

export function ImportRulesModal({ marketplace, onDone }: { marketplace: Marketplace; onDone: () => void }) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const objects = useMemo(() => (workbook && sheetName ? sheetToObjects(workbook, sheetName) : []), [workbook, sheetName]);

  const rows = useMemo<RuleImportRow[]>(
    () =>
      objects
        .map((row) => ({
          name: cellToString(getCell(row, RULE_SHEET_COLUMNS.name)),
          priority: cellToNumber(getCell(row, RULE_SHEET_COLUMNS.priority)),
          enabled: cellToBoolean(getCell(row, RULE_SHEET_COLUMNS.enabled)),
          rawCondition: cellToString(getCell(row, RULE_SHEET_COLUMNS.condition)),
          actionScript: cellToString(getCell(row, RULE_SHEET_COLUMNS.actionScript)) || undefined,
          // Нет колонки «Финальное» — значит файл экспортирован до появления каскадных правил,
          // считаем все правила финальными (прежнее поведение).
          isFinal: (() => {
            const cell = getCell(row, RULE_SHEET_COLUMNS.isFinal);
            return cell === undefined ? true : cellToBoolean(cell);
          })(),
        }))
        .filter((r) => r.name),
    [objects],
  );

  async function handleFile(file: File | null) {
    if (!file) return;
    const wb = await readWorkbook(file);
    setWorkbook(wb);
    setSheetName(getSheetNames(wb)[0] ?? null);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const { imported } = await rulesApi.import(marketplace.id, rows);
      notifications.show({
        message: `Импортировано правил: ${imported}. Не забудьте нажать «Пересчитать всё», чтобы обновить цены.`,
        color: "green",
      });
      onDone();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Stack>
      <FileInput
        label="Файл Excel / выгрузка из Google Sheets (.xlsx)"
        placeholder="Выберите файл"
        accept=".xlsx,.xls"
        onChange={handleFile}
        leftSection={<IconUpload size={16} />}
      />

      {workbook && (
        <>
          {getSheetNames(workbook).length > 1 && (
            <Select label="Лист" data={getSheetNames(workbook)} value={sheetName} onChange={setSheetName} allowDeselect={false} />
          )}

          <Alert color="blue" variant="light">
            Ожидаются колонки: «{RULE_SHEET_COLUMNS.name}», «{RULE_SHEET_COLUMNS.priority}», «{RULE_SHEET_COLUMNS.enabled}», «
            {RULE_SHEET_COLUMNS.condition}», «{RULE_SHEET_COLUMNS.actionScript}» (необязательно), «
            {RULE_SHEET_COLUMNS.isFinal}» (необязательно, по умолчанию «да») — именно в этом формате «Экспорт» сохраняет файл. Условие
            всегда загружается как сырое выражение. Правило с таким же названием в этом маркетплейсе будет обновлено, иначе — создано
            новое.
          </Alert>

          {rows.length > 0 ? (
            <ScrollArea.Autosize mah={280}>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{RULE_SHEET_COLUMNS.name}</Table.Th>
                    <Table.Th>{RULE_SHEET_COLUMNS.priority}</Table.Th>
                    <Table.Th>{RULE_SHEET_COLUMNS.enabled}</Table.Th>
                    <Table.Th>{RULE_SHEET_COLUMNS.condition}</Table.Th>
                    <Table.Th>{RULE_SHEET_COLUMNS.actionScript}</Table.Th>
                    <Table.Th>{RULE_SHEET_COLUMNS.isFinal}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{r.name}</Table.Td>
                      <Table.Td>{r.priority}</Table.Td>
                      <Table.Td>{r.enabled ? "да" : "нет"}</Table.Td>
                      <Table.Td>{r.rawCondition || "—"}</Table.Td>
                      <Table.Td>{r.actionScript || "—"}</Table.Td>
                      <Table.Td>{r.isFinal ? "да" : "нет"}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          ) : (
            <Text c="dimmed" size="sm">
              Не найдено ни одной строки с заполненным «{RULE_SHEET_COLUMNS.name}».
            </Text>
          )}

          <Group justify="flex-end">
            <Button onClick={handleImport} loading={importing} disabled={rows.length === 0}>
              Импортировать {rows.length > 0 ? `(${rows.length})` : ""}
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
