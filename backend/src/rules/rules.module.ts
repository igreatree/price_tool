import { Module } from "@nestjs/common";
import { MarketplaceRulesController, RulesController } from "./rules.controller";
import { RulesService } from "./rules.service";

@Module({
  controllers: [MarketplaceRulesController, RulesController],
  providers: [RulesService],
})
export class RulesModule {}
