import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateMarketplaceDto, UpdateMarketplaceDto } from "./dto/marketplace.dto";

@Injectable()
export class MarketplacesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.marketplace.findMany({ orderBy: { createdAt: "asc" } });
  }

  findOne(id: string) {
    return this.prisma.marketplace.findUniqueOrThrow({ where: { id } });
  }

  create(dto: CreateMarketplaceDto) {
    return this.prisma.marketplace.create({
      data: {
        ...dto,
        rounding: dto.rounding as unknown as Prisma.InputJsonValue,
        solver: dto.solver as unknown as Prisma.InputJsonValue,
        minPriceFormula: dto.minPriceFormula ?? "",
        maxPriceFormula: dto.maxPriceFormula ?? "",
      },
    });
  }

  update(id: string, dto: UpdateMarketplaceDto) {
    return this.prisma.marketplace.update({
      where: { id },
      data: {
        ...dto,
        rounding: dto.rounding as unknown as Prisma.InputJsonValue,
        solver: dto.solver as unknown as Prisma.InputJsonValue,
        minPriceFormula: dto.minPriceFormula ?? "",
        maxPriceFormula: dto.maxPriceFormula ?? "",
      },
    });
  }

  async remove(id: string) {
    // Rules / MarketplaceProductParams / CalculatedPrice cascade at the DB level (onDelete: Cascade).
    await this.prisma.marketplace.delete({ where: { id } });
  }
}
