import type { MarketplaceLike, RuleLike } from "./types";
import { evaluateCondition, evaluateFormula, type ExpressionContext } from "./expression";
import { conditionGroupToExpression } from "./condition-builder";
import { runExpressionScript, runActionScript } from "./js-script";
import { applyRounding } from "./rounding";
import { buildContext, protectedContextKeys, type BuildContextInput } from "./context";

export interface CalculatePriceInput extends BuildContextInput {
  marketplace: MarketplaceLike;
  rules: RuleLike[];
}

export interface CalculatePriceResult {
  productId: string;
  marketplaceId: string;
  price: number;
  netProceeds: number;
  marginRatio: number;
  /** Последнее (финальное) правило в применённой цепочке — для обратной совместимости. */
  appliedRuleId: string | null;
  /** Вся цепочка применённых правил по порядку — длиннее одного элемента только при каскадных
   * (не финальных) правилах. */
  appliedRuleIds: string[];
  warnings: string[];
  /** Товар исключён из автоперерасчёта для этого маркетплейса — вызывающая сторона (RecalcService)
   * не должна перезаписывать price/netProceeds/marginRatio существующей записи, только warnings. */
  excluded?: boolean;
}

export const EXCLUDED_WARNING = "Товар исключён из автоперерасчёта цены для этого маркетплейса";

function getConditionExpression(rule: RuleLike): string {
  return rule.conditionMode === "raw" ? rule.rawCondition : conditionGroupToExpression(rule.conditionGroup);
}

const emptyResult = (productId: string, marketplaceId: string, warnings: string[]): CalculatePriceResult => ({
  productId,
  marketplaceId,
  price: 0,
  netProceeds: 0,
  marginRatio: 0,
  appliedRuleId: null,
  appliedRuleIds: [],
  warnings,
});

/** Явный список ID или условие на вкладке настроек маркетплейса — если совпало, цену не трогаем. */
function isProductExcluded(input: CalculatePriceInput, context: ExpressionContext): boolean {
  const { product, marketplace } = input;
  if (marketplace.excludedProductIds.includes(product.id)) return true;
  if (!marketplace.exclusionCondition.trim()) return false;
  try {
    return evaluateCondition(marketplace.exclusionCondition, context);
  } catch {
    return false;
  }
}

/**
 * Расчёт цены для одной пары (товар, маркетплейс):
 * 1. Строим базовый контекст (идентичность товара + переменные из MarketplaceProductParams).
 * 2. Проверяем исключение — если товар исключён, цену не трогаем.
 * 3. marketplace.startPriceScript вычисляет стартовую цену (startPrice) от базового контекста —
 *    себестоимость товара тут лишь запасной вариант (по умолчанию startPriceScript её и
 *    использует), а не обязательное условие: если скрипт берёт цену у поставщика, startPrice
 *    может быть больше нуля даже при незаполненной себестоимости.
 * 4. Стартовая цена должна быть больше нуля — иначе считать не от чего.
 * 5. Каскад правил по возрастанию приоритета: у каждого подошедшего правила выполняется
 *    actionScript, который может изменить переменные (включая startPrice) или завести новые.
 *    Немаксимальное (isFinal === false) правило не останавливает каскад — поиск продолжается со
 *    следующей позиции по накопленному контексту. isFinal === true — каскад останавливается.
 * 6. marketplace.priceFormulaScript вычисляет итоговую цену от startPrice и финального состояния
 *    переменных.
 * 7. Применяются ограничения min/max цены и округление.
 * 8. netProceedsScript/marginRatioScript считают «выручку» и «X» по финальным переменным и
 *    итоговой цене — тоже настраиваются в маркетплейсе, а не зашиты в код.
 */
export function calculatePrice(input: CalculatePriceInput): CalculatePriceResult {
  const { product, marketplace, rules } = input;
  const warnings: string[] = [];

  const baseContext = buildContext(input);

  if (isProductExcluded(input, baseContext)) {
    return { ...emptyResult(product.id, marketplace.id, [EXCLUDED_WARNING]), excluded: true };
  }

  const startPrice = runExpressionScript(
    marketplace.startPriceScript,
    baseContext,
    product.cost,
    "Начальная цена",
    warnings,
  );

  if (!Number.isFinite(startPrice) || startPrice <= 0) {
    warnings.push("Стартовая цена не определена или не больше нуля");
    return emptyResult(product.id, marketplace.id, warnings);
  }

  let context: ExpressionContext = { ...baseContext, startPrice };
  const protectedKeys = protectedContextKeys(product);

  const activeRules = rules
    .filter((r) => r.enabled && r.marketplaceId === marketplace.id)
    .sort((a, b) => a.priority - b.priority);

  const appliedRuleIds: string[] = [];
  let searchFrom = 0;

  for (;;) {
    const matchIndex = activeRules.findIndex((rule, idx) => {
      if (idx < searchFrom) return false;
      const conditionExpr = getConditionExpression(rule);
      try {
        return evaluateCondition(conditionExpr, context);
      } catch (e) {
        warnings.push(`Правило "${rule.name}": ошибка в условии — ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    });
    if (matchIndex === -1) break;

    const rule = activeRules[matchIndex];
    context = runActionScript(rule.actionScript, context, protectedKeys, rule.name, warnings);
    appliedRuleIds.push(rule.id);

    if (rule.isFinal) break;
    searchFrom = matchIndex + 1;
  }

  const finalStartPrice = Number(context.startPrice);
  const priceFallback = Number.isFinite(finalStartPrice) ? finalStartPrice : startPrice;
  let price = runExpressionScript(marketplace.priceFormulaScript, context, priceFallback, "Основная формула", warnings);

  if (marketplace.minPriceFormula.trim()) {
    try {
      const minPrice = evaluateFormula(marketplace.minPriceFormula, context);
      if (price < minPrice) {
        price = minPrice;
        warnings.push("Цена ограничена снизу минимальной ценой");
      }
    } catch (e) {
      warnings.push(`Ошибка в формуле минимальной цены — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (marketplace.maxPriceFormula.trim()) {
    try {
      const maxPrice = evaluateFormula(marketplace.maxPriceFormula, context);
      if (price > maxPrice) {
        price = maxPrice;
        warnings.push("Цена ограничена сверху максимальной ценой");
      }
    } catch (e) {
      warnings.push(`Ошибка в формуле максимальной цены — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  price = applyRounding(price, marketplace.rounding);

  const netProceeds = runExpressionScript(marketplace.netProceedsScript, { ...context, price }, 0, "Формула выручки", warnings);
  const marginRatio = runExpressionScript(
    marketplace.marginRatioScript,
    { ...context, price, netProceeds },
    0,
    "Формула X",
    warnings,
  );

  return {
    productId: product.id,
    marketplaceId: marketplace.id,
    price,
    netProceeds,
    marginRatio,
    appliedRuleId: appliedRuleIds.length ? appliedRuleIds[appliedRuleIds.length - 1] : null,
    appliedRuleIds,
    warnings,
  };
}
