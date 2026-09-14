import { api } from "./client";
import type { Product } from "../types";

export interface ProductInput {
  externalId: string;
  name: string;
  brand?: string;
  cost: number;
  extra?: Record<string, string | number>;
}

export const productsApi = {
  list: () => api.get<Product[]>("/products"),
  get: (id: string) => api.get<Product>(`/products/${id}`),
  create: (input: ProductInput) => api.post<Product>("/products", input),
  update: (id: string, input: Partial<ProductInput>) => api.put<Product>(`/products/${id}`, input),
  remove: (id: string) => api.delete<void>(`/products/${id}`),
  import: (rows: ProductInput[]) => api.post<{ imported: number }>("/products/import", rows),
};
