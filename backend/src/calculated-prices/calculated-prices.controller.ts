import { Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecalcService } from "../pricing/recalc.service";

@Controller("marketplaces/:marketplaceId/calculated-prices")
export class CalculatedPricesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalcService: RecalcService,
  ) {}

  @Get()
  findAll(@Param("marketplaceId") marketplaceId: string) {
    return this.prisma.calculatedPrice.findMany({ where: { marketplaceId } });
  }
}

@Controller("marketplaces/:marketplaceId/recalculate")
export class RecalculateController {
  constructor(private readonly recalcService: RecalcService) {}

  @Post()
  async recalculate(@Param("marketplaceId") marketplaceId: string) {
    await this.recalcService.recalcMarketplace(marketplaceId);
    return { ok: true };
  }
}
