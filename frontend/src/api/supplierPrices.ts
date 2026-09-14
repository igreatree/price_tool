import { api } from "./client";
import type { SupplierPrice } from "../types";

export interface SupplierPriceInput {
  productId: string;
  supplierName: string;
  price: number;
}

export const supplierPricesApi = {
  list: () => api.get<SupplierPrice[]>("/supplier-prices"),
  create: (input: SupplierPriceInput) => api.post<SupplierPrice>("/supplier-prices", input),
  remove: (id: string) => api.delete<void>(`/supplier-prices/${id}`),
  import: (rows: SupplierPriceInput[]) => api.post<{ imported: number }>("/supplier-prices/import", rows),
};
