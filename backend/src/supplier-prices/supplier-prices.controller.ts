import { Body, Controller, Delete, Get, HttpCode, Param, ParseArrayPipe, Post } from "@nestjs/common";
import { SupplierPricesService } from "./supplier-prices.service";
import { CreateSupplierPriceDto, ImportSupplierPriceRowDto } from "./dto/supplier-price.dto";

@Controller("supplier-prices")
export class SupplierPricesController {
  constructor(private readonly service: SupplierPricesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateSupplierPriceDto) {
    return this.service.create(dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post("import")
  import(@Body(new ParseArrayPipe({ items: ImportSupplierPriceRowDto })) rows: ImportSupplierPriceRowDto[]) {
    return this.service.import(rows);
  }
}
