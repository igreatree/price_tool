import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecalcService } from "../pricing/recalc.service";
import type { CreateSupplierPriceDto, ImportSupplierPriceRowDto } from "./dto/supplier-price.dto";

@Injectable()
export class SupplierPricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalcService: RecalcService,
  ) {}

  findAll() {
    return this.prisma.supplierPrice.findMany();
  }

  async create(dto: CreateSupplierPriceDto) {
    const record = await this.prisma.supplierPrice.upsert({
      where: { productId_supplierName: { productId: dto.productId, supplierName: dto.supplierName } },
      create: dto,
      update: { price: dto.price, count: dto.count ?? 0 },
    });
    await this.recalcService.recalcProductAllMarketplaces(record.productId);
    return record;
  }

  async remove(id: string) {
    const record = await this.prisma.supplierPrice.delete({ where: { id } });
    await this.recalcService.recalcProductAllMarketplaces(record.productId);
  }

  async import(rows: ImportSupplierPriceRowDto[]) {
    // Keep only the last row per (productId, supplierName) so a single import never
    // creates two prices for the same product+supplier pair.
    const deduped = new Map<string, ImportSupplierPriceRowDto>();
    for (const row of rows) {
      deduped.set(`${row.productId}\u0000${row.supplierName}`, row);
    }
    const uniqueRows = [...deduped.values()];

    await this.prisma.$transaction(
      uniqueRows.map((row) =>
        this.prisma.supplierPrice.upsert({
          where: { productId_supplierName: { productId: row.productId, supplierName: row.supplierName } },
          create: row,
          update: { price: row.price, count: row.count ?? 0 },
        }),
      ),
    );
    await this.recalcService.recalcAllMarketplaces();
    return { imported: uniqueRows.length };
  }
}
