import { api } from "./client";
import type { ConditionGroup, Rule, RuleConditionMode } from "../types";

export interface RuleInput {
  name: string;
  priority: number;
  enabled: boolean;
  conditionMode: RuleConditionMode;
  conditionGroup: ConditionGroup;
  rawCondition?: string;
  formula: string;
  postScript?: string;
}

export interface RuleImportRow {
  name: string;
  priority: number;
  enabled: boolean;
  rawCondition?: string;
  formula: string;
  postScript?: string;
}

export const rulesApi = {
  listByMarketplace: (marketplaceId: string) => api.get<Rule[]>(`/marketplaces/${marketplaceId}/rules`),
  create: (marketplaceId: string, input: RuleInput) => api.post<Rule>(`/marketplaces/${marketplaceId}/rules`, input),
  update: (id: string, input: RuleInput) => api.put<Rule>(`/rules/${id}`, input),
  patch: (id: string, input: Partial<Pick<Rule, "enabled" | "priority">>) => api.patch<Rule>(`/rules/${id}`, input),
  remove: (id: string) => api.delete<void>(`/rules/${id}`),
  import: (marketplaceId: string, rows: RuleImportRow[]) =>
    api.post<{ imported: number }>(`/marketplaces/${marketplaceId}/rules/import`, rows),
};
