import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateRuleBodyDto, ImportRuleRowDto, PatchRuleDto, UpdateRuleDto } from "./dto/rule.dto";

const EMPTY_CONDITION_GROUP: Prisma.InputJsonValue = { joiner: "AND", rows: [] };

/** Пересчёт цен по правилам сюда намеренно не встроен — правила можно сохранять/удалять/импортировать
 * сколько угодно раз без дорогого пересчёта всех товаров, он запускается только явно, кнопкой
 * «Пересчитать всё» (см. RecalculateController). */
@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  findByMarketplace(marketplaceId: string) {
    return this.prisma.rule.findMany({ where: { marketplaceId }, orderBy: { priority: "asc" } });
  }

  create(marketplaceId: string, dto: CreateRuleBodyDto) {
    return this.prisma.rule.create({
      data: {
        ...dto,
        marketplaceId,
        conditionGroup: dto.conditionGroup as unknown as Prisma.InputJsonValue,
        rawCondition: dto.rawCondition ?? "",
        postScript: dto.postScript?.trim() || null,
        // undefined здесь Prisma трактует как "поле не передано" — на create применится дефолт "{}"
        schedule: dto.schedule as unknown as Prisma.InputJsonValue,
      },
    });
  }

  update(id: string, dto: UpdateRuleDto) {
    return this.prisma.rule.update({
      where: { id },
      data: {
        ...dto,
        conditionGroup: dto.conditionGroup as unknown as Prisma.InputJsonValue,
        rawCondition: dto.rawCondition ?? "",
        postScript: dto.postScript?.trim() || null,
        schedule: dto.schedule as unknown as Prisma.InputJsonValue,
      },
    });
  }

  patch(id: string, dto: PatchRuleDto) {
    return this.prisma.rule.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.rule.delete({ where: { id } });
  }

  /** Импорт из Excel/Google Sheets — находит правило по имени (без учёта регистра) в этом маркетплейсе:
   * если есть — обновляет, иначе создаёт новое. Условие всегда сохраняется как raw-выражение. */
  async importRows(marketplaceId: string, rows: ImportRuleRowDto[]) {
    const existing = await this.prisma.rule.findMany({ where: { marketplaceId } });
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
          formula: row.formula.trim(),
          postScript: row.postScript?.trim() || null,
          isFinal: row.isFinal ?? true,
        };
        return match
          ? this.prisma.rule.update({ where: { id: match.id }, data })
          : this.prisma.rule.create({ data });
      }),
    );

    return { imported: rows.length };
  }
}
