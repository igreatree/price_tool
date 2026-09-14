import { Body, Controller, Get, Param, ParseArrayPipe, Patch, Post } from "@nestjs/common";
import { MarketplaceParamsService } from "./marketplace-params.service";
import { ImportParamsRowDto, UpsertParamsDto } from "./dto/marketplace-params.dto";

@Controller("marketplaces/:marketplaceId/params")
export class MarketplaceParamsController {
  constructor(private readonly service: MarketplaceParamsService) {}

  @Get()
  findAll(@Param("marketplaceId") marketplaceId: string) {
    return this.service.findByMarketplace(marketplaceId);
  }

  @Patch(":productId")
  upsertField(@Param("marketplaceId") marketplaceId: string, @Param("productId") productId: string, @Body() dto: UpsertParamsDto) {
    return this.service.upsertField(marketplaceId, productId, dto);
  }

  @Post("import")
  import(@Param("marketplaceId") marketplaceId: string, @Body(new ParseArrayPipe({ items: ImportParamsRowDto })) rows: ImportParamsRowDto[]) {
    return this.service.import(marketplaceId, rows);
  }
}
