import { Parser, type Expression } from "expr-eval";

const parser = new Parser();
// Регистронезависимая подстрока — используется оператором «содержит» в условиях правил.
parser.functions.contains = (haystack: unknown, needle: unknown) =>
  String(haystack ?? "").toLowerCase().includes(String(needle ?? "").toLowerCase());

export type ExpressionContext = Record<string, number | string | ((...args: any[]) => number)>;

export class ExpressionError extends Error {}

/**
 * expr-eval понимает логические операторы только в нижнем регистре (and/or/not),
 * а ТЗ требует AND/OR/NOT — заменяем их как отдельные слова, не трогая строковые литералы.
 */
function normalizeLogicalOperators(expr: string): string {
  const parts = expr.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(/\bAND\b/gi, "and").replace(/\bOR\b/gi, "or").replace(/\bNOT\b/gi, "not");
    })
    .join("");
}

export function parseExpression(expr: string): Expression {
  const normalized = normalizeLogicalOperators(expr);
  try {
    return parser.parse(normalized);
  } catch (e) {
    throw new ExpressionError(e instanceof Error ? e.message : String(e));
  }
}

export function evaluateCondition(expr: string, context: ExpressionContext): boolean {
  if (!expr.trim()) return true;
  const parsed = parseExpression(expr);
  return Boolean(parsed.evaluate(context));
}

export function evaluateFormula(expr: string, context: ExpressionContext): number {
  const parsed = parseExpression(expr);
  const result = parsed.evaluate(context);
  const num = Number(result);
  if (!Number.isFinite(num)) {
    throw new ExpressionError(`Формула вернула не число: ${String(result)}`);
  }
  return num;
}

export function validateExpression(expr: string): string | null {
  if (!expr.trim()) return null;
  try {
    parseExpression(expr);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
