import type { ExpressionContext } from "./expression";

/**
 * Браузерный аналог backend/src/pricing/js-script.ts — используется только для превью в редакторе
 * правил/маркетплейса против реальных данных, которые администратор уже видит и которым доверяет.
 * Настоящий расчёт, который сохраняется в базу, всегда выполняется на сервере через node:vm —
 * здесь просто нет vm-модуля, поэтому used new Function; таймаут недоступен, но это не нужно для
 * превью по требованию пользователя.
 */

/** Скрипт-выражение: должен явно вернуть число (return ...;). */
export function runExpressionScript(
  script: string,
  context: ExpressionContext,
  fallback: number,
  label: string,
  warnings: string[],
): number {
  if (!script || !script.trim()) return fallback;
  try {
    const keys = Object.keys(context);
    // eslint-disable-next-line no-new-func -- контролируемый JS-скрипт, введённый самим администратором
    const fn = new Function(...keys, script);
    const result = fn(...keys.map((k) => context[k]));
    const num = Number(result);
    if (Number.isFinite(num)) return num;
    warnings.push(`${label}: скрипт вернул не число — использовано значение по умолчанию`);
    return fallback;
  } catch (e) {
    warnings.push(`${label}: ошибка в скрипте — ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

/**
 * Скрипт-действие правила: поддерживает изменение уже существующих в контексте переменных
 * (discount/taxRate/commissionRate/logistics/ads/otherExpenses/startPrice и т.д. — всё, кроме
 * protectedKeys) через обычное присваивание вроде `commissionRate = commissionRate + 0.05;`.
 * В отличие от серверной версии (где скрипт выполняется в vm-контексте, который сам является
 * глобальным объектом, поэтому произвольное новое имя переменной тоже становится свойством
 * контекста), браузерная превью-версия НЕ подхватывает переменные, которых не было в контексте
 * до выполнения скрипта — это ограничение только превью, реальный расчёт на сервере такие
 * переменные подхватывает.
 */
export function runActionScript(
  script: string,
  context: ExpressionContext,
  protectedKeys: ReadonlySet<string>,
  ruleName: string,
  warnings: string[],
): ExpressionContext {
  if (!script || !script.trim()) return context;
  const keys = Object.keys(context);
  const mutableKeys = keys.filter((k) => !protectedKeys.has(k) && typeof context[k] !== "function");
  try {
    const returnExpr = mutableKeys.map((k) => `${k}: ${k}`).join(", ");
    // eslint-disable-next-line no-new-func -- контролируемый JS-скрипт, введённый самим администратором
    const fn = new Function(...keys, `${script}\nreturn { ${returnExpr} };`);
    const result = fn(...keys.map((k) => context[k])) as Record<string, unknown>;
    const next: ExpressionContext = { ...context };
    for (const key of mutableKeys) {
      const value = result[key];
      if (typeof value === "number" || typeof value === "string") next[key] = value;
    }
    return next;
  } catch (e) {
    warnings.push(`Правило "${ruleName}": ошибка в скрипте действия — ${e instanceof Error ? e.message : String(e)}`);
    return context;
  }
}
