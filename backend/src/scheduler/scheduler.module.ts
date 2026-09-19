import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RuleSchedulerService } from "./rule-scheduler.service";

@Module({
  imports: [PricingModule, NotificationsModule],
  providers: [RuleSchedulerService],
})
export class SchedulerModule {}
