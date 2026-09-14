import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { SupplierPricesController } from "./supplier-prices.controller";
import { SupplierPricesService } from "./supplier-prices.service";

@Module({
  imports: [PricingModule],
  controllers: [SupplierPricesController],
  providers: [SupplierPricesService],
})
export class SupplierPricesModule {}
