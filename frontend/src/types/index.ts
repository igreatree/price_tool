export interface Product {
  id: string;
  externalId: string;
  name: string;
  cost: number;
  brand: string;
  extra: Record<string, string | number>;
  updatedAt: string;
}

export interface SupplierPrice {
  id: string;
  productId: string;
  supplierName: string;
  price: number;
  updatedAt: string;
}

export type ExpenseType = "fixed" | "percent";

export interface Expense {
  id: string;
  name: string;
  type: ExpenseType;
  value: number;
  appliesToAll: boolean;
  productIds: string[];
}

export interface MarketplaceProductParams {
  id: string;
  productId: string;
  marketplaceId: string;
  discount: number;
  taxRate: number;
  commissionRate: number;
  logistics: number;
  ads: number;
  otherExpenses: number;
  updatedAt: string;
}

export type RoundingMode = "none" | "nearest" | "up" | "down";

export interface RoundingConfig {
  mode: RoundingMode;
  step: number;
  forceEnding?: number;
}

export type PricingMode = "direct" | "targetMargin";

export interface SolverConfig {
  minX: number;
  maxX: number;
  searchMultiplierMin: number;
  searchMultiplierMax: number;
  maxIterations: number;
}

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface RecalcScheduleDay {
  enabled: boolean;
  /** "HH:MM", 24-часовой формат, в таймзоне сервера (SCHEDULER_TIMEZONE). */
  time: string;
}

/** День, отсутствующий в объекте, значит выключен — так выглядит recalcSchedule маркетплейсов,
 * ни разу не настраивавших расписание. */
export type RecalcSchedule = Partial<Record<WeekDay, RecalcScheduleDay>>;

export interface Marketplace {
  id: string;
  name: string;
  pricingMode: PricingMode;
  rounding: RoundingConfig;
  minPriceFormula: string;
  maxPriceFormula: string;
  solver: SolverConfig;
  excludedProductIds: string[];
  exclusionCondition: string;
  recalcSchedule: RecalcSchedule;
  createdAt: string;
}

export type ConditionOperator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "notContains";
export type ConditionJoiner = "AND" | "OR";

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

export type RuleConditionMode = "builder" | "raw";

export interface Rule {
  id: string;
  marketplaceId: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditionMode: RuleConditionMode;
  conditionGroup: ConditionGroup;
  rawCondition: string;
  formula: string;
  postScript?: string;
  /** Если false — при совпадении условия каскад продолжается к следующему подходящему правилу
   * (по приоритету), которому передаётся цена этого правила через переменную prevPrice. */
  isFinal: boolean;
  createdAt: string;
}

export interface CalculatedPrice {
  id: string;
  productId: string;
  marketplaceId: string;
  price: number;
  netProceeds: number;
  marginRatio: number;
  appliedRuleId: string | null;
  appliedRuleIds: string[];
  iterations: number;
  calculatedAt: string;
  warnings: string[];
}
