import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RecalcService } from "../pricing/recalc.service";
import type { CreateRuleBodyDto, PatchRuleDto, UpdateRuleDto } from "./dto/rule.dto";

@Injectable()
export class RulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalcService: RecalcService,
  ) {}

  findByMarketplace(marketplaceId: string) {
    return this.prisma.rule.findMany({ where: { marketplaceId }, orderBy: { priority: "asc" } });
  }

  async create(marketplaceId: string, dto: CreateRuleBodyDto) {
    const record = await this.prisma.rule.create({
      data: {
        ...dto,
        marketplaceId,
        conditionGroup: dto.conditionGroup as unknown as Prisma.InputJsonValue,
        rawCondition: dto.rawCondition ?? "",
      },
    });
    await this.recalcService.recalcMarketplace(record.marketplaceId);
    return record;
  }

  async update(id: string, dto: UpdateRuleDto) {
    const record = await this.prisma.rule.update({
      where: { id },
      data: { ...dto, conditionGroup: dto.conditionGroup as unknown as Prisma.InputJsonValue, rawCondition: dto.rawCondition ?? "" },
    });
    await this.recalcService.recalcMarketplace(record.marketplaceId);
    return record;
  }

  async patch(id: string, dto: PatchRuleDto) {
    const record = await this.prisma.rule.update({ where: { id }, data: dto });
    await this.recalcService.recalcMarketplace(record.marketplaceId);
    return record;
  }

  async remove(id: string) {
    const record = await this.prisma.rule.delete({ where: { id } });
    await this.recalcService.recalcMarketplace(record.marketplaceId);
  }
}
