import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCountRuleBodyDto, ImportCountRuleRowDto, PatchCountRuleDto, UpdateCountRuleDto } from "./dto/count-rule.dto";

const EMPTY_CONDITION_GROUP: Prisma.InputJsonValue = { joiner: "AND", rows: [] };

/** Пересчёт остатков по правилам сюда намеренно не встроен — правила можно сохранять/удалять/
 * импортировать сколько угодно раз без дорогого пересчёта всех товаров, он запускается только
 * явно, кнопкой «Рассчитать остаток» (см. RecalculateController). */
@Injectable()
export class CountRulesService {
  constructor(private readonly prisma: PrismaService) {}

  findByMarketplace(marketplaceId: string) {
    return this.prisma.countRule.findMany({ where: { marketplaceId }, orderBy: { priority: "asc" } });
  }

  create(marketplaceId: string, dto: CreateCountRuleBodyDto) {
    return this.prisma.countRule.create({
      data: {
        ...dto,
        marketplaceId,
        conditionGroup: dto.conditionGroup as unknown as Prisma.InputJsonValue,
        rawCondition: dto.rawCondition ?? "",
        script: dto.script?.trim() ?? "",
      },
    });
  }

  update(id: string, dto: UpdateCountRuleDto) {
    return this.prisma.countRule.update({
      where: { id },
      data: {
        ...dto,
        conditionGroup: dto.conditionGroup as unknown as Prisma.InputJsonValue,
        rawCondition: dto.rawCondition ?? "",
        script: dto.script?.trim() ?? "",
      },
    });
  }

  patch(id: string, dto: PatchCountRuleDto) {
    return this.prisma.countRule.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.countRule.delete({ where: { id } });
  }

  /** Импорт из Excel/Google Sheets — находит правило по имени (без учёта регистра) в этом маркетплейсе:
   * если есть — обновляет, иначе создаёт новое. Условие всегда сохраняется как raw-выражение. */
  async importRows(marketplaceId: string, rows: ImportCountRuleRowDto[]) {
    const existing = await this.prisma.countRule.findMany({ where: { marketplaceId } });
    const existingByName = new Map(existing.map((r) => [r.name.trim().toLowerCase(), r]));

    await this.prisma.$transaction(
      rows.map((row) => {
        const match = existingByName.get(row.name.trim().toLowerCase());
        const data = {
          marketplaceId,
          name: row.name.trim(),
          priority: row.priority,
          enabled: row.enabled,
          conditionMode: "raw" as const,
          conditionGroup: EMPTY_CONDITION_GROUP,
          rawCondition: row.rawCondition ?? "",
          script: row.script?.trim() ?? "",
          isFinal: row.isFinal ?? true,
        };
        return match
          ? this.prisma.countRule.update({ where: { id: match.id }, data })
          : this.prisma.countRule.create({ data });
      }),
    );

    return { imported: rows.length };
  }
}
