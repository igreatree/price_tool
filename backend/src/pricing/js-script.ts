import vm from "node:vm";
import type { ExpressionContext } from "./expression";

/**
 * Скрипты (startPriceScript, priceFormulaScript, Rule.actionScript) — JS, сохранённый вместе с
 * настройками маркетплейса/правила самим авторизованным пользователем приложения (тот же уровень
 * доверия, что и раньше выполнялся на клиенте через new Function). Изолируем через vm с коротким
 * таймаутом и без доступа к Node-глобалам. node:vm не является настоящей песочницей безопасности —
 * это приемлемо только потому, что это внутренний инструмент с доверенными администраторами.
 */

/**
 * Скрипт-выражение: должен явно вернуть число (return ...;). Используется для startPriceScript и
 * priceFormulaScript маркетплейса. При ошибке или нечисловом результате пишет warning и возвращает
 * fallback, не прерывая расчёт остальных товаров.
 */
export function runExpressionScript(
  script: string,
  context: ExpressionContext,
  fallback: number,
  label: string,
  warnings: string[],
): number {
  if (!script || !script.trim()) return fallback;
  try {
    const sandbox = vm.createContext({ ...context, __result__: undefined });
    vm.runInContext(`__result__ = (function() { ${script}\n })();`, sandbox, { timeout: 100 });
    const result = (sandbox as { __result__?: unknown }).__result__;
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
 * Скрипт-действие правила: выполняется как набор операторов (без обёртки в функцию с return),
 * поэтому присваивание вида `commissionRate = commissionRate + 0.05;` напрямую меняет переменную —
 * она уже существует как свойство глобального объекта песочницы. Объявления let/const остаются
 * локальными для скрипта и не переносятся обратно в контекст. После выполнения все собственные
 * свойства песочницы (кроме функций и protectedKeys) переносятся в новый контекст — так правило
 * может изменить существующую переменную (discount/taxRate/commissionRate/logistics/ads/
 * otherExpenses/startPrice) или завести новую для дальнейших правил и основной формулы.
 */
export function runActionScript(
  script: string,
  context: ExpressionContext,
  protectedKeys: ReadonlySet<string>,
  ruleName: string,
  warnings: string[],
): ExpressionContext {
  if (!script || !script.trim()) return context;
  try {
    const sandbox = vm.createContext({ ...context });
    vm.runInContext(script, sandbox, { timeout: 100 });
    const next: ExpressionContext = { ...context };
    for (const key of Object.keys(sandbox)) {
      if (protectedKeys.has(key)) continue;
      const value = (sandbox as Record<string, unknown>)[key];
      if (typeof value === "function") continue;
      if (typeof value === "number" || typeof value === "string") {
        next[key] = value;
      }
    }
    return next;
  } catch (e) {
    warnings.push(`Правило "${ruleName}": ошибка в скрипте действия — ${e instanceof Error ? e.message : String(e)}`);
    return context;
  }
}
