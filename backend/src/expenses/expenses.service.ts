import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecalcService } from "../pricing/recalc.service";
import type { CreateExpenseDto, UpdateExpenseDto } from "./dto/expense.dto";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalcService: RecalcService,
  ) {}

  findAll() {
    return this.prisma.expense.findMany();
  }

  async create(dto: CreateExpenseDto) {
    const record = await this.prisma.expense.create({ data: { ...dto, productIds: dto.productIds ?? [] } });
    await this.recalcService.recalcAllMarketplaces();
    return record;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const record = await this.prisma.expense.update({ where: { id }, data: dto });
    await this.recalcService.recalcAllMarketplaces();
    return record;
  }

  async remove(id: string) {
    await this.prisma.expense.delete({ where: { id } });
    await this.recalcService.recalcAllMarketplaces();
  }
}
