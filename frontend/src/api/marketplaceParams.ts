import { api } from "./client";
import type { MarketplaceProductParams } from "../types";

export interface ParamsFieldsInput {
  discount?: number;
  taxRate?: number;
  commissionRate?: number;
  logistics?: number;
  ads?: number;
  otherExpenses?: number;
}

export interface ImportParamsRow extends ParamsFieldsInput {
  productId: string;
}

export const marketplaceParamsApi = {
  listByMarketplace: (marketplaceId: string) => api.get<MarketplaceProductParams[]>(`/marketplaces/${marketplaceId}/params`),
  upsertField: (marketplaceId: string, productId: string, fields: ParamsFieldsInput) =>
    api.patch<MarketplaceProductParams>(`/marketplaces/${marketplaceId}/params/${productId}`, fields),
  import: (marketplaceId: string, rows: ImportParamsRow[]) =>
    api.post<{ imported: number }>(`/marketplaces/${marketplaceId}/params/import`, rows),
};
