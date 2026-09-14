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
    const record = await this.prisma.supplierPrice.create({ data: dto });
    await this.recalcService.recalcProductAllMarketplaces(record.productId);
    return record;
  }

  async remove(id: string) {
    const record = await this.prisma.supplierPrice.delete({ where: { id } });
    await this.recalcService.recalcProductAllMarketplaces(record.productId);
  }

  async import(rows: ImportSupplierPriceRowDto[]) {
    const result = await this.prisma.supplierPrice.createMany({ data: rows });
    await this.recalcService.recalcAllMarketplaces();
    return { imported: result.count };
  }
}
