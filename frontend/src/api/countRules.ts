import { api } from "./client";
import type { ConditionGroup, CountRule, RuleConditionMode } from "../types";

export interface CountRuleInput {
  name: string;
  priority: number;
  enabled: boolean;
  conditionMode: RuleConditionMode;
  conditionGroup: ConditionGroup;
  rawCondition?: string;
  script?: string;
  isFinal: boolean;
}

export interface CountRuleImportRow {
  name: string;
  priority: number;
  enabled: boolean;
  rawCondition?: string;
  script?: string;
  isFinal?: boolean;
}

export const countRulesApi = {
  listByMarketplace: (marketplaceId: string) => api.get<CountRule[]>(`/marketplaces/${marketplaceId}/count-rules`),
  create: (marketplaceId: string, input: CountRuleInput) => api.post<CountRule>(`/marketplaces/${marketplaceId}/count-rules`, input),
  update: (id: string, input: CountRuleInput) => api.put<CountRule>(`/count-rules/${id}`, input),
  patch: (id: string, input: Partial<Pick<CountRule, "enabled" | "priority">>) => api.patch<CountRule>(`/count-rules/${id}`, input),
  remove: (id: string) => api.delete<void>(`/count-rules/${id}`),
  import: (marketplaceId: string, rows: CountRuleImportRow[]) =>
    api.post<{ imported: number }>(`/marketplaces/${marketplaceId}/count-rules/import`, rows),
};
