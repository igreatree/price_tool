import * as XLSX from "xlsx";

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

export function getSheetNames(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames;
}

/** Возвращает лист как матрицу строк/ячеек (первая строка — не обязательно заголовок). */
export function sheetToMatrix(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
}

/** Возвращает лист как объекты по заголовкам первой строки — для фиксированных, известных заранее форматов. */
export function sheetToObjects(workbook: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
}

export function exportRowsToExcel(sheetName: string, rows: Record<string, unknown>[], fileName: string): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, fileName);
}

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function cellToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const str = cellToString(value).replace(",", ".").replace(/\s/g, "");
  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
}

export function cellToBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const str = cellToString(value).toLowerCase();
  return ["true", "1", "да", "истина", "yes"].includes(str);
}
