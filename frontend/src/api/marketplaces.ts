import { api } from "./client";
import type { Marketplace, PricingMode, RoundingConfig, SolverConfig } from "../types";

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
  remove: (id: string) => api.delete<void>(`/marketplaces/${id}`),
};
