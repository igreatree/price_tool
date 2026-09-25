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
  /** Остаток товара у этого поставщика. */
  count: number;
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

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface Marketplace {
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

export type RuleScheduleAction = "enable" | "disable";

export interface RuleScheduleEntry {
  action: RuleScheduleAction;
  /** "HH:MM", 24-часовой формат, в таймзоне сервера (SCHEDULER_TIMEZONE). */
  time: string;
}

/** День, отсутствующий в объекте (или null), не управляется расписанием — правило переключается
 * автоматически только в те дни, для которых явно задана запись. */
export type RuleSchedule = Partial<Record<WeekDay, RuleScheduleEntry | null>>;

export interface Rule {
  id: string;
  marketplaceId: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditionMode: RuleConditionMode;
  conditionGroup: ConditionGroup;
  rawCondition: string;
  /** JS-скрипт действия: меняет переменные контекста расчёта (напр. commissionRate = commissionRate + 0.05;). */
  actionScript: string;
  /** Если false — при совпадении условия каскад продолжается к следующему подходящему правилу
   * (по приоритету), сохраняя изменения переменных, сделанные этим правилом. */
  isFinal: boolean;
  schedule: RuleSchedule;
  createdAt: string;
}

export interface CountRule {
  id: string;
  marketplaceId: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditionMode: RuleConditionMode;
  conditionGroup: ConditionGroup;
  rawCondition: string;
  /** JS-скрипт: обязателен явный return числа — остаток товара, если условие подошло. */
  script: string;
  /** Если false — при совпадении условия каскад продолжается к следующему подходящему правилу
   * (по приоритету), которому передаётся результат этого правила через prevCount. */
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
  calculatedAt: string;
  warnings: string[];
  /** Остаток товара — считается независимо от цены, каскадом «Правил остатков». */
  count: number;
  appliedCountRuleId: string | null;
  appliedCountRuleIds: string[];
  countWarnings: string[];
  countCalculatedAt: string | null;
}
