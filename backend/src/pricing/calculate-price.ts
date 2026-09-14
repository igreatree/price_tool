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
  appliedRuleId: string | null;
  iterations: number;
  warnings: string[];
}

function getConditionExpression(rule: RuleLike): string {
  return rule.conditionMode === "raw" ? rule.rawCondition : conditionGroupToExpression(rule.conditionGroup);
}

function computeExpensesTotal(expenses: ExpenseLike[], product: ProductLike): number {
  return expenses
    .filter((e) => e.appliesToAll || e.productIds.includes(product.id))
    .reduce((sum, e) => sum + (e.type === "fixed" ? e.value : (e.value / 100) * product.cost), 0);
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
  iterations: 0,
  warnings,
});

/** Реализует 14-шаговый алгоритм расчёта цены для одной пары (товар, маркетплейс). */
export function calculatePrice(input: CalculatePriceInput): CalculatePriceResult {
  const { product, marketplace, rules } = input;
  const warnings: string[] = [];

  if (!Number.isFinite(product.cost) || product.cost <= 0) {
    warnings.push("Себестоимость не задана или не больше нуля");
    return emptyResult(product.id, marketplace.id, warnings);
  }

  const context = buildContext(input);

  const activeRules = rules
    .filter((r) => r.enabled && r.marketplaceId === marketplace.id)
    .sort((a, b) => a.priority - b.priority);

  const matchedRule = activeRules.find((rule) => {
    const conditionExpr = getConditionExpression(rule);
    try {
      return evaluateCondition(conditionExpr, context);
    } catch (e) {
      warnings.push(`Правило "${rule.name}": ошибка в условии — ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  });

  if (!matchedRule) {
    warnings.push("Ни одно правило не подошло для этого товара");
    return emptyResult(product.id, marketplace.id, warnings);
  }

  let price: number;
  let netProceeds: number;
  let marginRatio: number;
  let iterations = 0;

  try {
    if (marketplace.pricingMode === "direct") {
      price = evaluateFormula(matchedRule.formula, context);
      netProceeds = price - product.cost - (context.expensesTotal as number);
      marginRatio = product.cost !== 0 ? netProceeds / product.cost : 0;
    } else {
      const solved = solvePrice(
        (candidatePrice) => evaluateFormula(matchedRule.formula, { ...context, price: candidatePrice }),
        product.cost,
        marketplace.solver,
      );
      price = solved.price;
      netProceeds = solved.netProceeds;
      marginRatio = solved.marginRatio;
      iterations = solved.iterations;
      if (!solved.converged) {
        warnings.push(`Решение не найдено за ${marketplace.solver.maxIterations} итераций — взята ближайшая цена`);
      }
    }
  } catch (e) {
    warnings.push(`Правило "${matchedRule.name}": ошибка в формуле — ${e instanceof Error ? e.message : String(e)}`);
    return emptyResult(product.id, marketplace.id, warnings);
  }

  price = applyPostScript(matchedRule.postScript, context, price, warnings);

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

  if (marketplace.pricingMode === "targetMargin") {
    try {
      netProceeds = evaluateFormula(matchedRule.formula, { ...context, price });
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
    appliedRuleId: matchedRule.id,
    iterations,
    warnings,
  };
}
