export type ExpenseType = "fixed" | "percent";
export type PricingMode = "direct" | "targetMargin";
export type RuleConditionMode = "builder" | "raw";
export type RoundingMode = "none" | "nearest" | "up" | "down";
export type ConditionOperator = "==" | "!=" | ">" | "<" | ">=" | "<=";
export type ConditionJoiner = "AND" | "OR";

export interface RoundingConfig {
  mode: RoundingMode;
  step: number;
  forceEnding?: number | null;
}

export interface SolverConfig {
  minX: number;
  maxX: number;
  searchMultiplierMin: number;
  searchMultiplierMax: number;
  maxIterations: number;
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
  pricingMode: PricingMode;
  rounding: RoundingConfig;
  minPriceFormula: string;
  maxPriceFormula: string;
  solver: SolverConfig;
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
  formula: string;
  postScript?: string | null;
}
