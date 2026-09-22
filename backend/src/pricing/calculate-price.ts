import vm from "node:vm";
import type {
  ProductLike,
  SupplierPriceLike,
  MarketplaceProductParamsLike,
  ExpenseLike,
  MarketplaceLike,
  RuleLike,
} from "./types";
import { evaluateCondition, evaluateFormula, type ExpressionContext } from "./expression";
import { conditionGroupToExpression } from "./condition-builder";
import { solvePrice } from "./solver";
import { applyRounding } from "./rounding";

export interface CalculatePriceInput {
  product: ProductLike;
  supplierPrices: SupplierPriceLike[];
  marketplaceParams: MarketplaceProductParamsLike | undefined;
  expenses: ExpenseLike[];
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
  iterations: number;
  warnings: string[];
  /** Товар исключён из автоперерасчёта для этого маркетплейса — вызывающая сторона (RecalcService)
   * не должна перезаписывать price/netProceeds/marginRatio существующей записи, только warnings. */
  excluded?: boolean;
}

export const EXCLUDED_WARNING = "Товар исключён из автоперерасчёта цены для этого маркетплейса";

function getConditionExpression(rule: RuleLike): string {
  return rule.conditionMode === "raw" ? rule.rawCondition : conditionGroupToExpression(rule.conditionGroup);
}

/** Правило может переопределить режим ценообразования маркетплейса через priceMode — иначе наследует его. */
function effectivePriceMode(rule: RuleLike, marketplace: MarketplaceLike): MarketplaceLike["pricingMode"] {
  return rule.priceMode ?? marketplace.pricingMode;
}

function computeExpensesTotal(expenses: ExpenseLike[], product: ProductLike): number {
  return expenses
    .filter((e) => e.appliesToAll || e.productIds.includes(product.id))
    .reduce((sum, e) => sum + (e.type === "fixed" ? e.value : (e.value / 100) * product.cost), 0);
}

/**
 * Позволяет в условии/формуле правила сослаться на цену конкретного поставщика по имени,
 * а не только на bestSupplierPrice (минимум по всем). Сравнение без учёта регистра/пробелов;
 * если у товара несколько записей от одного поставщика — берётся минимальная; если поставщика
 * с таким именем нет — 0 (как и остальные отсутствующие числовые переменные контекста).
 */
function makeSupplierPriceLookup(supplierPrices: SupplierPriceLike[]): (supplierName: string) => number {
  return (supplierName: string) => {
    const needle = String(supplierName ?? "").trim().toLowerCase();
    const matches = supplierPrices.filter((s) => s.supplierName.trim().toLowerCase() === needle);
    return matches.length ? Math.min(...matches.map((s) => s.price)) : 0;
  };
}

function buildContext(input: CalculatePriceInput): ExpressionContext {
  const { product, supplierPrices, marketplaceParams, expenses } = input;
  const bestSupplierPrice = supplierPrices.length ? Math.min(...supplierPrices.map((s) => s.price)) : 0;

  return {
    cost: product.cost,
    brand: product.brand,
    name: product.name,
    externalId: product.externalId,
    ...product.extra,
    bestSupplierPrice,
    supplierPricesCount: supplierPrices.length,
    supplierPrice: makeSupplierPriceLookup(supplierPrices),
    expensesTotal: computeExpensesTotal(expenses, product),
    discount: marketplaceParams?.discount ?? 0,
    taxRate: marketplaceParams?.taxRate ?? 0,
    commissionRate: marketplaceParams?.commissionRate ?? 0,
    logistics: marketplaceParams?.logistics ?? 0,
    ads: marketplaceParams?.ads ?? 0,
    otherExpenses: marketplaceParams?.otherExpenses ?? 0,
  };
}

/**
 * postScript — пользовательский JS, сохранённый вместе с правилом самим авторизованным
 * пользователем приложения (тот же уровень доверия, что и раньше выполнялся на клиенте
 * через new Function). Изолируем через vm с коротким таймаутом и без доступа к Node-глобалам.
 */
function applyPostScript(script: string | null | undefined, context: ExpressionContext, price: number, warnings: string[]): number {
  if (!script || !script.trim()) return price;
  try {
    const sandbox = vm.createContext({ ctx: { ...context }, price, __result__: undefined });
    vm.runInContext(`__result__ = (function(ctx, price) { ${script} })(ctx, price);`, sandbox, { timeout: 100 });
    const result = (sandbox as { __result__?: unknown }).__result__;
    const num = Number(result);
    if (Number.isFinite(num)) return num;
    warnings.push("Скрипт вернул не число — результат проигнорирован");
    return price;
  } catch (e) {
    warnings.push(`Ошибка в скрипте: ${e instanceof Error ? e.message : String(e)}`);
    return price;
  }
}

const emptyResult = (productId: string, marketplaceId: string, warnings: string[]): CalculatePriceResult => ({
  productId,
  marketplaceId,
  price: 0,
  netProceeds: 0,
  marginRatio: 0,
  appliedRuleId: null,
  appliedRuleIds: [],
  iterations: 0,
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

/** Реализует 14-шаговый алгоритм расчёта цены для одной пары (товар, маркетплейс). */
export function calculatePrice(input: CalculatePriceInput): CalculatePriceResult {
  const { product, marketplace, rules } = input;
  const warnings: string[] = [];

  const context = buildContext(input);

  if (isProductExcluded(input, context)) {
    return { ...emptyResult(product.id, marketplace.id, [EXCLUDED_WARNING]), excluded: true };
  }

  if (!Number.isFinite(product.cost) || product.cost <= 0) {
    warnings.push("Себестоимость не задана или не больше нуля");
    return emptyResult(product.id, marketplace.id, warnings);
  }

  const activeRules = rules
    .filter((r) => r.enabled && r.marketplaceId === marketplace.id)
    .sort((a, b) => a.priority - b.priority);

  /**
   * Каскад: правила проверяются по возрастанию приоритета. Если подошедшее правило не финальное
   * (isFinal === false), его цена передаётся следующему подходящему правилу через prevPrice
   * (0, если ещё ни одно правило не сработало) — вместо того, чтобы сразу стать итоговой. Поиск
   * следующего правила продолжается строго после позиции текущего в отсортированном списке, поэтому
   * одно и то же правило не может сработать дважды и бесконечный цикл невозможен.
   */
  let price = 0;
  let netProceeds = 0;
  let marginRatio = 0;
  let iterations = 0;
  const appliedRuleIds: string[] = [];
  let lastAppliedRule: RuleLike | null = null;
  let lastStageContext: ExpressionContext = context;
  let searchFrom = 0;

  for (;;) {
    const matchIndex = activeRules.findIndex((rule, idx) => {
      if (idx < searchFrom) return false;
      const conditionExpr = getConditionExpression(rule);
      try {
        return evaluateCondition(conditionExpr, { ...context, prevPrice: price });
      } catch (e) {
        warnings.push(`Правило "${rule.name}": ошибка в условии — ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    });
    if (matchIndex === -1) break;

    const rule = activeRules[matchIndex];
    const stageContext: ExpressionContext = { ...context, prevPrice: price };

    try {
      if (effectivePriceMode(rule, marketplace) === "direct") {
        price = evaluateFormula(rule.formula, stageContext);
        netProceeds = price - product.cost - (context.expensesTotal as number);
        marginRatio = product.cost !== 0 ? netProceeds / product.cost : 0;
      } else {
        const solved = solvePrice(
          (candidatePrice) => evaluateFormula(rule.formula, { ...stageContext, price: candidatePrice }),
          product.cost,
          marketplace.solver,
        );
        price = solved.price;
        netProceeds = solved.netProceeds;
        marginRatio = solved.marginRatio;
        iterations += solved.iterations;
        if (!solved.converged) {
          warnings.push(`Решение не найдено за ${marketplace.solver.maxIterations} итераций — взята ближайшая цена`);
        }
      }
    } catch (e) {
      warnings.push(`Правило "${rule.name}": ошибка в формуле — ${e instanceof Error ? e.message : String(e)}`);
      if (appliedRuleIds.length === 0) {
        return emptyResult(product.id, marketplace.id, warnings);
      }
      break;
    }

    price = applyPostScript(rule.postScript, stageContext, price, warnings);
    appliedRuleIds.push(rule.id);
    lastAppliedRule = rule;
    lastStageContext = stageContext;

    if (rule.isFinal) break;
    searchFrom = matchIndex + 1;
  }

  if (!lastAppliedRule) {
    warnings.push("Ни одно правило не подошло для этого товара");
    return emptyResult(product.id, marketplace.id, warnings);
  }

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

  if (effectivePriceMode(lastAppliedRule, marketplace) === "targetMargin") {
    try {
      netProceeds = evaluateFormula(lastAppliedRule.formula, { ...lastStageContext, price });
      marginRatio = product.cost !== 0 ? netProceeds / product.cost : 0;
    } catch {
      // если формула перестала считаться на округлённой цене — оставляем последнее известное значение
    }
  } else {
    netProceeds = price - product.cost - (context.expensesTotal as number);
    marginRatio = product.cost !== 0 ? netProceeds / product.cost : 0;
  }

  return {
    productId: product.id,
    marketplaceId: marketplace.id,
    price,
    netProceeds,
    marginRatio,
    appliedRuleId: lastAppliedRule.id,
    appliedRuleIds,
    iterations,
    warnings,
  };
}
