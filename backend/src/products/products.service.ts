import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecalcService } from "../pricing/recalc.service";
import type { CreateProductDto, ImportProductRowDto, UpdateProductDto } from "./dto/product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalcService: RecalcService,
  ) {}

  findAll() {
    return this.prisma.product.findMany({ orderBy: { name: "asc" } });
  }

  findOne(id: string) {
    return this.prisma.product.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: { ...dto, brand: dto.brand ?? "", extra: dto.extra ?? {} },
    });
    await this.recalcService.recalcProductAllMarketplaces(product.id);
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.update({ where: { id }, data: dto });
    await this.recalcService.recalcProductAllMarketplaces(product.id);
    return product;
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
  }

  async import(rows: ImportProductRowDto[]) {
    const chunkSize = 500;
    let imported = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await this.prisma.$transaction(
        chunk.map((row) =>
          this.prisma.product.upsert({
            where: { externalId: row.externalId },
            create: { ...row, brand: row.brand ?? "", extra: row.extra ?? {} },
            update: { name: row.name, brand: row.brand ?? "", cost: row.cost, extra: row.extra ?? {} },
          }),
        ),
      );
      imported += chunk.length;
    }
    await this.recalcService.recalcAllMarketplaces();
    return { imported };
  }
}
