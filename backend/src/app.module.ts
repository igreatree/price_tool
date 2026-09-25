import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { PricingModule } from "./pricing/pricing.module";
import { ProductsModule } from "./products/products.module";
import { SupplierPricesModule } from "./supplier-prices/supplier-prices.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { MarketplacesModule } from "./marketplaces/marketplaces.module";
import { RulesModule } from "./rules/rules.module";
import { CountRulesModule } from "./count-rules/count-rules.module";
import { MarketplaceParamsModule } from "./marketplace-params/marketplace-params.module";
import { CalculatedPricesModule } from "./calculated-prices/calculated-prices.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PricingModule,
    ProductsModule,
    SupplierPricesModule,
    ExpensesModule,
    MarketplacesModule,
    RulesModule,
    CountRulesModule,
    MarketplaceParamsModule,
    CalculatedPricesModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
