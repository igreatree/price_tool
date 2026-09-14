import { Body, Controller, Delete, Get, Param, ParseArrayPipe, Post, Put } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto, ImportProductRowDto, UpdateProductDto } from "./dto/product.dto";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }

  @Post("import")
  import(@Body(new ParseArrayPipe({ items: ImportProductRowDto })) rows: ImportProductRowDto[]) {
    return this.productsService.import(rows);
  }
}
