import { api } from "./client";
import type { Expense, ExpenseType } from "../types";

export interface ExpenseInput {
  name: string;
  type: ExpenseType;
  value: number;
  appliesToAll: boolean;
  productIds?: string[];
}

export const expensesApi = {
  list: () => api.get<Expense[]>("/expenses"),
  create: (input: ExpenseInput) => api.post<Expense>("/expenses", input),
  update: (id: string, input: ExpenseInput) => api.put<Expense>(`/expenses/${id}`, input),
  remove: (id: string) => api.delete<void>(`/expenses/${id}`),
};
