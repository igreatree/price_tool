import { Module } from "@nestjs/common";
import { RecalcService } from "./recalc.service";

@Module({
  providers: [RecalcService],
  exports: [RecalcService],
})
export class PricingModule {}
