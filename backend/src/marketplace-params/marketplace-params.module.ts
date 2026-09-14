import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { MarketplaceParamsController } from "./marketplace-params.controller";
import { MarketplaceParamsService } from "./marketplace-params.service";

@Module({
  imports: [PricingModule],
  controllers: [MarketplaceParamsController],
  providers: [MarketplaceParamsService],
})
export class MarketplaceParamsModule {}
