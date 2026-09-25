import { Body, Controller, Delete, Get, HttpCode, Param, ParseArrayPipe, Patch, Post, Put } from "@nestjs/common";
import { CountRulesService } from "./count-rules.service";
import { CreateCountRuleBodyDto, ImportCountRuleRowDto, PatchCountRuleDto, UpdateCountRuleDto } from "./dto/count-rule.dto";

@Controller("marketplaces/:marketplaceId/count-rules")
export class MarketplaceCountRulesController {
  constructor(private readonly service: CountRulesService) {}

  @Get()
  findAll(@Param("marketplaceId") marketplaceId: string) {
    return this.service.findByMarketplace(marketplaceId);
  }

  @Post()
  create(@Param("marketplaceId") marketplaceId: string, @Body() dto: CreateCountRuleBodyDto) {
    return this.service.create(marketplaceId, dto);
  }

  @Post("import")
  import(
    @Param("marketplaceId") marketplaceId: string,
    @Body(new ParseArrayPipe({ items: ImportCountRuleRowDto })) rows: ImportCountRuleRowDto[],
  ) {
    return this.service.importRows(marketplaceId, rows);
  }
}

@Controller("count-rules")
export class CountRulesController {
  constructor(private readonly service: CountRulesService) {}

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCountRuleDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id")
  patch(@Param("id") id: string, @Body() dto: PatchCountRuleDto) {
    return this.service.patch(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
