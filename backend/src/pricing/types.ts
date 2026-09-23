export type ExpenseType = "fixed" | "percent";
export type RuleConditionMode = "builder" | "raw";
export type RoundingMode = "none" | "nearest" | "up" | "down";
export type ConditionOperator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "notContains";
export type ConditionJoiner = "AND" | "OR";

export interface RoundingConfig {
  mode: RoundingMode;
  step: number;
  forceEnding?: number | null;
}

export interface ConditionRow {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionGroup {
  joiner: ConditionJoiner;
  rows: ConditionRow[];
}

export interface ProductLike {
  id: string;
  externalId: string;
  name: string;
  brand: string;
  cost: number;
  extra: Record<string, string | number>;
}

export interface SupplierPriceLike {
  id: string;
  productId: string;
  supplierName: string;
  price: number;
}

export interface ExpenseLike {
  id: string;
  name: string;
  type: ExpenseType;
  value: number;
  appliesToAll: boolean;
  productIds: string[];
}

export interface MarketplaceProductParamsLike {
  discount: number;
  taxRate: number;
  commissionRate: number;
  logistics: number;
  ads: number;
  otherExpenses: number;
}

export interface MarketplaceLike {
  id: string;
  name: string;
  rounding: RoundingConfig;
  minPriceFormula: string;
  maxPriceFormula: string;
  excludedProductIds: string[];
  exclusionCondition: string;
  /** JS-скрипт, вычисляющий стартовую цену товара (обязателен явный return числа). */
  startPriceScript: string;
  /** Основная JS-формула, вычисляющая итоговую цену из startPrice и переменных (обязателен явный
   * return числа). */
  priceFormulaScript: string;
}

export interface RuleLike {
  id: string;
  marketplaceId: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditionMode: RuleConditionMode;
  conditionGroup: ConditionGroup;
  rawCondition: string;
  /** JS-скрипт действия: набор операторов, меняющих переменные контекста расчёта (например,
   * `commissionRate = commissionRate + 0.05;`). */
  actionScript: string;
  /** Если false — каскад не останавливается на этом правиле: изменения переменных сохраняются и
   * поиск продолжается со следующего подходящего правила. */
  isFinal: boolean;
}
