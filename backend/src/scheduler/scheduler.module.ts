import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RecalcSchedulerService } from "./recalc-scheduler.service";

@Module({
  imports: [PricingModule, NotificationsModule],
  providers: [RecalcSchedulerService],
})
export class SchedulerModule {}
