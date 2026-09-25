import { Module } from "@nestjs/common";
import { MarketplaceCountRulesController, CountRulesController } from "./count-rules.controller";
import { CountRulesService } from "./count-rules.service";

@Module({
  controllers: [MarketplaceCountRulesController, CountRulesController],
  providers: [CountRulesService],
})
export class CountRulesModule {}
