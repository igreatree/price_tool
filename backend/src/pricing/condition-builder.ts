import type { ConditionGroup, ConditionRow } from "./types";

function escapeStringLiteral(value: string): string {
  return `"${value.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function formatValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return trimmed;
  }
  return escapeStringLiteral(value);
}

function rowToExpression(row: ConditionRow): string {
  const field = row.field.trim();
  // contains/notContains всегда сравнивают со строкой, даже если введено число (например, ищем "2024" в названии).
  if (row.operator === "contains") return `contains(${field}, ${escapeStringLiteral(row.value)})`;
  if (row.operator === "notContains") return `not contains(${field}, ${escapeStringLiteral(row.value)})`;
  return `${field} ${row.operator} ${formatValue(row.value)}`;
}

export function conditionGroupToExpression(group: ConditionGroup): string {
  const validRows = group.rows.filter((row) => row.field.trim() !== "");
  if (validRows.length === 0) return "";
  const joiner = group.joiner === "AND" ? "AND" : "OR";
  return validRows.map(rowToExpression).join(` ${joiner} `);
}
