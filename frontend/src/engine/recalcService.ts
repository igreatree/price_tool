import { db } from "../db/db";
import { calculatePrice, type CalculatePriceResult } from "./calculatePrice";
import { createId } from "../utils/id";
import type { Product, Marketplace, SupplierPrice } from "../types";

export interface RecalcProgress {
  done: number;
  total: number;
}

function toRecord(result: CalculatePriceResult, id: string) {
  return {
    id,
    productId: result.productId,
    marketplaceId: result.marketplaceId,
    price: result.price,
    netProceeds: result.netProceeds,
    marginRatio: result.marginRatio,
    appliedRuleId: result.appliedRuleId,
    iterations: result.iterations,
    calculatedAt: Date.now(),
    warnings: result.warnings,
  };
}

/** Точечный пересчёт одного товара по одному маркетплейсу (например, после правки товара/цены поставщика). */
export async function recalcProductForMarketplace(product: Product, marketplace: Marketplace): Promise<CalculatePriceResult> {
  const [supplierPrices, marketplaceParams, expenses, rules] = await Promise.all([
    db.supplierPrices.where("productId").equals(product.id).toArray(),
    db.marketplaceProductParams.where("[productId+marketplaceId]").equals([product.id, marketplace.id]).first(),
    db.expenses.toArray(),
    db.rules.where("marketplaceId").equals(marketplace.id).toArray(),
  ]);

  const result = calculatePrice({ product, supplierPrices, marketplaceParams, expenses, marketplace, rules });

  const existing = await db.calculatedPrices
    .where("[productId+marketplaceId]")
    .equals([product.id, marketplace.id])
    .first();
  await db.calculatedPrices.put(toRecord(result, existing?.id ?? createId()));

  return result;
}

/** Пересчёт одного товара сразу по всем маркетплейсам — вызывается после изменения товара/цен поставщиков. */
export async function recalcProductAllMarketplaces(product: Product): Promise<void> {
  const marketplaces = await db.marketplaces.toArray();
  await Promise.all(marketplaces.map((m) => recalcProductForMarketplace(product, m)));
}

/**
 * Массовый пересчёт всех товаров для одного маркетплейса (после правки маркетплейса/правил).
 * Обрабатывает чанками, отдавая управление event loop'у между ними, чтобы не подвешивать UI
 * на каталоге в тысячи товаров.
 */
export async function recalcMarketplace(
  marketplace: Marketplace,
  onProgress?: (progress: RecalcProgress) => void,
  chunkSize = 300,
): Promise<void> {
  const products = await db.products.toArray();
  const [expenses, rules] = await Promise.all([
    db.expenses.toArray(),
    db.rules.where("marketplaceId").equals(marketplace.id).toArray(),
  ]);

  const total = products.length;
  let done = 0;
  onProgress?.({ done, total });

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    const productIds = chunk.map((p) => p.id);

    const [supplierPrices, marketplaceParamsList, existing] = await Promise.all([
      db.supplierPrices.where("productId").anyOf(productIds).toArray(),
      db.marketplaceProductParams
        .where("productId")
        .anyOf(productIds)
        .and((p) => p.marketplaceId === marketplace.id)
        .toArray(),
      db.calculatedPrices
        .where("marketplaceId")
        .equals(marketplace.id)
        .and((c) => productIds.includes(c.productId))
        .toArray(),
    ]);

    const supplierPricesByProduct = new Map<string, SupplierPrice[]>();
    for (const sp of supplierPrices) {
      const list = supplierPricesByProduct.get(sp.productId) ?? [];
      list.push(sp);
      supplierPricesByProduct.set(sp.productId, list);
    }
    const paramsByProduct = new Map(marketplaceParamsList.map((p) => [p.productId, p]));
    const existingIdByProduct = new Map(existing.map((e) => [e.productId, e.id]));

    const toPut = chunk.map((product) => {
      const result = calculatePrice({
        product,
        supplierPrices: supplierPricesByProduct.get(product.id) ?? [],
        marketplaceParams: paramsByProduct.get(product.id),
        expenses,
        marketplace,
        rules,
      });
      return toRecord(result, existingIdByProduct.get(product.id) ?? createId());
    });

    await db.calculatedPrices.bulkPut(toPut);

    done += chunk.length;
    onProgress?.({ done, total });

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export async function recalcAllMarketplaces(onProgress?: (progress: RecalcProgress) => void): Promise<void> {
  const marketplaces = await db.marketplaces.toArray();
  for (const marketplace of marketplaces) {
    await recalcMarketplace(marketplace, onProgress);
  }
}
