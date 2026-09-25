import type { CountRuleLike } from "./types";
import { evaluateCondition, type ExpressionContext } from "./expression";
import { conditionGroupToExpression } from "./condition-builder";
import { runExpressionScript } from "./js-script";
import { buildContext, type BuildContextInput } from "./context";

export interface CalculateCountInput extends BuildContextInput {
  marketplaceId: string;
  rules: CountRuleLike[];
}

export interface CalculateCountResult {
  productId: string;
  marketplaceId: string;
  count: number;
  /** Последнее (финальное) правило в применённой цепочке. */
  appliedRuleId: string | null;
  /** Вся цепочка применённых правил по порядку — длиннее одного элемента только при каскадных
   * (не финальных) правилах. */
  appliedRuleIds: string[];
  warnings: string[];
}

function getConditionExpression(rule: CountRuleLike): string {
  return rule.conditionMode === "raw" ? rule.rawCondition : conditionGroupToExpression(rule.conditionGroup);
}

/**
 * Остаток товара считается независимо от цены, каскадом «Правил остатков»:
 * 1. Строим тот же базовый контекст, что и для цены (cost, brand, ..., supplierData, ...).
 * 2. Правила проверяются по возрастанию приоритета. У первого подошедшего правила выполняется
 *    script (обязателен явный return числа), который видит prevCount — результат предыдущего
 *    неполного правила в цепочке (0, если это первое сработавшее правило).
 * 3. Немаксимальное (isFinal === false) правило не останавливает каскад — поиск продолжается со
 *    следующей позиции, передавая результат дальше через prevCount. isFinal === true — каскад
 *    останавливается.
 * 4. Если ни одно правило не подошло — остаток равен 0.
 */
export function calculateCount(input: CalculateCountInput): CalculateCountResult {
  const { product, marketplaceId, rules } = input;
  const warnings: string[] = [];
  const context = buildContext(input);

  const activeRules = rules
    .filter((r) => r.enabled && r.marketplaceId === marketplaceId)
    .sort((a, b) => a.priority - b.priority);

  let count = 0;
  const appliedRuleIds: string[] = [];
  let lastApplied: CountRuleLike | null = null;
  let searchFrom = 0;

  for (;;) {
    const matchIndex = activeRules.findIndex((rule, idx) => {
      if (idx < searchFrom) return false;
      const conditionExpr = getConditionExpression(rule);
      try {
        return evaluateCondition(conditionExpr, { ...context, prevCount: count });
      } catch (e) {
        warnings.push(`Правило "${rule.name}": ошибка в условии — ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    });
    if (matchIndex === -1) break;

    const rule = activeRules[matchIndex];
    const stageContext: ExpressionContext = { ...context, prevCount: count };
    count = runExpressionScript(rule.script, stageContext, count, `Правило "${rule.name}"`, warnings);
    appliedRuleIds.push(rule.id);
    lastApplied = rule;

    if (rule.isFinal) break;
    searchFrom = matchIndex + 1;
  }

  return {
    productId: product.id,
    marketplaceId,
    count,
    appliedRuleId: lastApplied?.id ?? null,
    appliedRuleIds,
    warnings,
  };
}
