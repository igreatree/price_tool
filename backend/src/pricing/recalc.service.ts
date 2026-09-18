import { Injectable, NotFoundException } from "@nestjs/common";
import type { Expense, Marketplace, Product, Rule } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { calculatePrice, type CalculatePriceResult } from "./calculate-price";
import type {
  ConditionGroup,
  ExpenseLike,
  MarketplaceLike,
  ProductLike,
  RoundingConfig,
  RuleLike,
  SolverConfig,
} from "./types";

function toProductLike(p: Product): ProductLike {
  return {
    id: p.id,
    externalId: p.externalId,
    name: p.name,
    brand: p.brand,
    cost: p.cost,
    extra: (p.extra as Record<string, string | number>) ?? {},
  };
}

function toExpenseLike(e: Expense): ExpenseLike {
  return {
    id: e.id,
    name: e.name,
    type: e.type,
    value: e.value,
    appliesToAll: e.appliesToAll,
    productIds: e.productIds,
  };
}

function toMarketplaceLike(m: Marketplace): MarketplaceLike {
  return {
    id: m.id,
    name: m.name,
    pricingMode: m.pricingMode,
    rounding: m.rounding as unknown as RoundingConfig,
    minPriceFormula: m.minPriceFormula,
    maxPriceFormula: m.maxPriceFormula,
    solver: m.solver as unknown as SolverConfig,
    excludedProductIds: m.excludedProductIds,
    exclusionCondition: m.exclusionCondition,
  };
}

function toRuleLike(r: Rule): RuleLike {
  return {
    id: r.id,
    marketplaceId: r.marketplaceId,
    name: r.name,
    priority: r.priority,
    enabled: r.enabled,
    conditionMode: r.conditionMode,
    conditionGroup: r.conditionGroup as unknown as ConditionGroup,
    rawCondition: r.rawCondition,
    formula: r.formula,
    postScript: r.postScript,
    isFinal: r.isFinal,
  };
}

@Injectable()
export class RecalcService {
  constructor(private readonly prisma: PrismaService) {}

  private async persist(result: CalculatePriceResult): Promise<void> {
    if (result.excluded) {
      // Исключённый товар: цену не трогаем — только фиксируем предупреждение и время проверки.
      // Если записи ещё не было (первый расчёт для этой пары), создаём с нулевой ценой — трогать нечего.
      await this.prisma.calculatedPrice.upsert({
        where: { productId_marketplaceId: { productId: result.productId, marketplaceId: result.marketplaceId } },
        create: {
          productId: result.productId,
          marketplaceId: result.marketplaceId,
          price: 0,
          netProceeds: 0,
          marginRatio: 0,
          appliedRuleId: null,
          appliedRuleIds: [],
          iterations: 0,
          warnings: result.warnings,
        },
        update: {
          warnings: result.warnings,
          calculatedAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.calculatedPrice.upsert({
      where: { productId_marketplaceId: { productId: result.productId, marketplaceId: result.marketplaceId } },
      create: {
        productId: result.productId,
        marketplaceId: result.marketplaceId,
        price: result.price,
        netProceeds: result.netProceeds,
        marginRatio: result.marginRatio,
        appliedRuleId: result.appliedRuleId,
        appliedRuleIds: result.appliedRuleIds,
        iterations: result.iterations,
        warnings: result.warnings,
      },
      update: {
        price: result.price,
        netProceeds: result.netProceeds,
        marginRatio: result.marginRatio,
        appliedRuleId: result.appliedRuleId,
        appliedRuleIds: result.appliedRuleIds,
        iterations: result.iterations,
        warnings: result.warnings,
        calculatedAt: new Date(),
      },
    });
  }

  async recalcProductForMarketplace(productId: string, marketplaceId: string): Promise<CalculatePriceResult> {
    const [product, marketplace, marketplaceParams, expenses, rules, supplierPrices] = await Promise.all([
      this.prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      this.prisma.marketplace.findUniqueOrThrow({ where: { id: marketplaceId } }),
      this.prisma.marketplaceProductParams.findUnique({ where: { productId_marketplaceId: { productId, marketplaceId } } }),
      this.prisma.expense.findMany(),
      this.prisma.rule.findMany({ where: { marketplaceId } }),
      this.prisma.supplierPrice.findMany({ where: { productId } }),
    ]);

    const result = calculatePrice({
      product: toProductLike(product),
      supplierPrices: supplierPrices.map((s) => ({ id: s.id, productId: s.productId, supplierName: s.supplierName, price: s.price })),
      marketplaceParams: marketplaceParams ?? undefined,
      expenses: expenses.map(toExpenseLike),
      marketplace: toMarketplaceLike(marketplace),
      rules: rules.map(toRuleLike),
    });

    await this.persist(result);
    return result;
  }

  async recalcProductAllMarketplaces(productId: string): Promise<void> {
    const marketplaces = await this.prisma.marketplace.findMany({ select: { id: true } });
    await Promise.all(marketplaces.map((m) => this.recalcProductForMarketplace(productId, m.id)));
  }

  async recalcMarketplace(marketplaceId: string, chunkSize = 300): Promise<{ productsCount: number }> {
    const marketplace = await this.prisma.marketplace.findUnique({ where: { id: marketplaceId } });
    if (!marketplace) throw new NotFoundException("Маркетплейс не найден");

    const [products, expenses, rules] = await Promise.all([
      this.prisma.product.findMany(),
      this.prisma.expense.findMany(),
      this.prisma.rule.findMany({ where: { marketplaceId } }),
    ]);

    const marketplaceLike = toMarketplaceLike(marketplace);
    const expenseLikes = expenses.map(toExpenseLike);
    const ruleLikes = rules.map(toRuleLike);

    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const productIds = chunk.map((p) => p.id);

      const [supplierPrices, paramsList] = await Promise.all([
        this.prisma.supplierPrice.findMany({ where: { productId: { in: productIds } } }),
        this.prisma.marketplaceProductParams.findMany({ where: { marketplaceId, productId: { in: productIds } } }),
      ]);

      const supplierPricesByProduct = new Map<string, typeof supplierPrices>();
      for (const sp of supplierPrices) {
        const list = supplierPricesByProduct.get(sp.productId) ?? [];
        list.push(sp);
        supplierPricesByProduct.set(sp.productId, list);
      }
      const paramsByProduct = new Map(paramsList.map((p) => [p.productId, p]));

      const results = chunk.map((product) =>
        calculatePrice({
          product: toProductLike(product),
          supplierPrices: (supplierPricesByProduct.get(product.id) ?? []).map((s) => ({
            id: s.id,
            productId: s.productId,
            supplierName: s.supplierName,
            price: s.price,
          })),
          marketplaceParams: paramsByProduct.get(product.id) ?? undefined,
          expenses: expenseLikes,
          marketplace: marketplaceLike,
          rules: ruleLikes,
        }),
      );

      await Promise.all(results.map((r) => this.persist(r)));
    }

    return { productsCount: products.length };
  }

  async recalcAllMarketplaces(): Promise<void> {
    const marketplaces = await this.prisma.marketplace.findMany({ select: { id: true } });
    for (const marketplace of marketplaces) {
      await this.recalcMarketplace(marketplace.id);
    }
  }
}
