import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { RulesService } from "./rules.service";
import { CreateRuleBodyDto, PatchRuleDto, UpdateRuleDto } from "./dto/rule.dto";

@Controller("marketplaces/:marketplaceId/rules")
export class MarketplaceRulesController {
  constructor(private readonly service: RulesService) {}

  @Get()
  findAll(@Param("marketplaceId") marketplaceId: string) {
    return this.service.findByMarketplace(marketplaceId);
  }

  @Post()
  create(@Param("marketplaceId") marketplaceId: string, @Body() dto: CreateRuleBodyDto) {
    return this.service.create(marketplaceId, dto);
  }
}

@Controller("rules")
export class RulesController {
  constructor(private readonly service: RulesService) {}

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRuleDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id")
  patch(@Param("id") id: string, @Body() dto: PatchRuleDto) {
    return this.service.patch(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
