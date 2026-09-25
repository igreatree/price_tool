import type { ProductLike, SupplierPriceLike, MarketplaceProductParamsLike, ExpenseLike } from "./types";
import type { ExpressionContext } from "./expression";

export interface BuildContextInput {
  product: ProductLike;
  supplierPrices: SupplierPriceLike[];
  marketplaceParams: MarketplaceProductParamsLike | undefined;
  expenses: ExpenseLike[];
}

export function computeExpensesTotal(expenses: ExpenseLike[], product: ProductLike): number {
  return expenses
    .filter((e) => e.appliesToAll || e.productIds.includes(product.id))
    .reduce((sum, e) => sum + (e.type === "fixed" ? e.value : (e.value / 100) * product.cost), 0);
}

/**
 * Позволяет в условии/скрипте правила или маркетплейса сослаться на цену конкретного поставщика
 * по имени, а не только на bestSupplierPrice (минимум по всем). Сравнение без учёта регистра/
 * пробелов; если у товара несколько записей от одного поставщика — берётся минимальная; если
 * поставщика с таким именем нет — 0 (как и остальные отсутствующие числовые переменные контекста).
 */
export function makeSupplierPriceLookup(supplierPrices: SupplierPriceLike[]): (supplierName: string) => number {
  return (supplierName: string) => {
    const needle = String(supplierName ?? "").trim().toLowerCase();
    const matches = supplierPrices.filter((s) => s.supplierName.trim().toLowerCase() === needle);
    return matches.length ? Math.min(...matches.map((s) => s.price)) : 0;
  };
}

/** Общий базовый контекст для расчёта и цены (calculate-price.ts), и остатка (calculate-count.ts). */
export function buildContext(input: BuildContextInput): ExpressionContext {
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
    supplierData: supplierPrices.map((s) => ({ name: s.supplierName, price: s.price, count: s.count })),
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
 * Переменные, которые скрипт действия правила цены не должен затирать — это идентичность товара и
 * рассчитанные из него агрегаты, а не переменные формулы цены. Всё остальное в контексте
 * (discount/taxRate/commissionRate/logistics/ads/otherExpenses/startPrice и любые переменные,
 * заведённые предыдущими правилами) правила менять могут.
 */
export function protectedContextKeys(product: ProductLike): Set<string> {
  return new Set([
    "cost",
    "brand",
    "name",
    "externalId",
    "bestSupplierPrice",
    "supplierPricesCount",
    "supplierPrice",
    "supplierData",
    "expensesTotal",
    ...Object.keys(product.extra ?? {}),
  ]);
}
