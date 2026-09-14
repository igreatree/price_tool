import type { ConditionGroup } from "./types";

function formatValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return trimmed;
  }
  const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function conditionGroupToExpression(group: ConditionGroup): string {
  const validRows = group.rows.filter((row) => row.field.trim() !== "");
  if (validRows.length === 0) return "";
  const joiner = group.joiner === "AND" ? "AND" : "OR";
  return validRows.map((row) => `${row.field.trim()} ${row.operator} ${formatValue(row.value)}`).join(` ${joiner} `);
}
