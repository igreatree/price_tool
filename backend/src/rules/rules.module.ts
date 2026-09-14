import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { MarketplaceRulesController, RulesController } from "./rules.controller";
import { RulesService } from "./rules.service";

@Module({
  imports: [PricingModule],
  controllers: [MarketplaceRulesController, RulesController],
  providers: [RulesService],
})
export class RulesModule {}
