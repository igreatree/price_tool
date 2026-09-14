import { Module } from "@nestjs/common";
import { MarketplacesController } from "./marketplaces.controller";
import { MarketplacesService } from "./marketplaces.service";

@Module({
  controllers: [MarketplacesController],
  providers: [MarketplacesService],
})
export class MarketplacesModule {}
