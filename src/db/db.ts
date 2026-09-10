import Dexie, { type EntityTable } from "dexie";
import type {
  Product,
  SupplierPrice,
  Expense,
  MarketplaceProductParams,
  Marketplace,
  Rule,
  CalculatedPrice,
  AppSettings,
} from "../types";

export const db = new Dexie("price-tool") as Dexie & {
  products: EntityTable<Product, "id">;
  supplierPrices: EntityTable<SupplierPrice, "id">;
  expenses: EntityTable<Expense, "id">;
  marketplaceProductParams: EntityTable<MarketplaceProductParams, "id">;
  marketplaces: EntityTable<Marketplace, "id">;
  rules: EntityTable<Rule, "id">;
  calculatedPrices: EntityTable<CalculatedPrice, "id">;
  settings: EntityTable<AppSettings, "id">;
};

db.version(1).stores({
  products: "id, externalId, brand, name",
  supplierPrices: "id, productId, supplierName",
  expenses: "id, name",
  marketplaceProductParams: "id, productId, marketplaceId, [productId+marketplaceId]",
  marketplaces: "id, name",
  rules: "id, marketplaceId, priority",
  calculatedPrices: "id, productId, marketplaceId, [productId+marketplaceId]",
  settings: "id",
});
