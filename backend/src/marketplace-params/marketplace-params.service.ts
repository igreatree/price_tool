import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecalcService } from "../pricing/recalc.service";
import type { ImportParamsRowDto, UpsertParamsDto } from "./dto/marketplace-params.dto";

@Injectable()
export class MarketplaceParamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalcService: RecalcService,
  ) {}

  findByMarketplace(marketplaceId: string) {
    return this.prisma.marketplaceProductParams.findMany({ where: { marketplaceId } });
  }

  async upsertField(marketplaceId: string, productId: string, dto: UpsertParamsDto) {
    const record = await this.prisma.marketplaceProductParams.upsert({
      where: { productId_marketplaceId: { productId, marketplaceId } },
      create: {
        productId,
        marketplaceId,
        discount: dto.discount ?? 0,
        taxRate: dto.taxRate ?? 0,
        commissionRate: dto.commissionRate ?? 0,
        logistics: dto.logistics ?? 0,
        ads: dto.ads ?? 0,
        otherExpenses: dto.otherExpenses ?? 0,
      },
      update: dto,
    });
    await this.recalcService.recalcProductForMarketplace(productId, marketplaceId);
    return record;
  }

  async import(marketplaceId: string, rows: ImportParamsRowDto[]) {
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await this.prisma.$transaction(
        chunk.map(({ productId, ...dto }) =>
          this.prisma.marketplaceProductParams.upsert({
            where: { productId_marketplaceId: { productId, marketplaceId } },
            create: {
              productId,
              marketplaceId,
              discount: dto.discount ?? 0,
              taxRate: dto.taxRate ?? 0,
              commissionRate: dto.commissionRate ?? 0,
              logistics: dto.logistics ?? 0,
              ads: dto.ads ?? 0,
              otherExpenses: dto.otherExpenses ?? 0,
            },
            update: dto,
          }),
        ),
      );
    }
    await this.recalcService.recalcMarketplace(marketplaceId);
    return { imported: rows.length };
  }
}
