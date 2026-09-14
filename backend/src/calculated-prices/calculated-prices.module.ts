import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { CalculatedPricesController, RecalculateController } from "./calculated-prices.controller";

@Module({
  imports: [PricingModule],
  controllers: [CalculatedPricesController, RecalculateController],
})
export class CalculatedPricesModule {}
