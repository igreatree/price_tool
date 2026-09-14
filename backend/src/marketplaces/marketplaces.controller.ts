import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { MarketplacesService } from "./marketplaces.service";
import { CreateMarketplaceDto, UpdateMarketplaceDto } from "./dto/marketplace.dto";

@Controller("marketplaces")
export class MarketplacesController {
  constructor(private readonly service: MarketplacesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMarketplaceDto) {
    return this.service.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateMarketplaceDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
