import { api } from "./client";
import type { Marketplace, PricingMode, RecalcSchedule, RoundingConfig, SolverConfig } from "../types";

export interface MarketplaceInput {
  name: string;
  pricingMode: PricingMode;
  rounding: RoundingConfig;
  minPriceFormula?: string;
  maxPriceFormula?: string;
  solver: SolverConfig;
  excludedProductIds?: string[];
  exclusionCondition?: string;
}

export const marketplacesApi = {
  list: () => api.get<Marketplace[]>("/marketplaces"),
  get: (id: string) => api.get<Marketplace>(`/marketplaces/${id}`),
  create: (input: MarketplaceInput) => api.post<Marketplace>("/marketplaces", input),
  update: (id: string, input: MarketplaceInput) => api.put<Marketplace>(`/marketplaces/${id}`, input),
  updateSchedule: (id: string, schedule: Required<RecalcSchedule>) =>
    api.patch<Marketplace>(`/marketplaces/${id}/schedule`, schedule),
  remove: (id: string) => api.delete<void>(`/marketplaces/${id}`),
};
