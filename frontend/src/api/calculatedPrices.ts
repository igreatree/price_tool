import { api } from "./client";
import type { CalculatedPrice } from "../types";

export const calculatedPricesApi = {
  listByMarketplace: (marketplaceId: string) => api.get<CalculatedPrice[]>(`/marketplaces/${marketplaceId}/calculated-prices`),
  recalculate: (marketplaceId: string) => api.post<{ ok: true }>(`/marketplaces/${marketplaceId}/recalculate`),
};
