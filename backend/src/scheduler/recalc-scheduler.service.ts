import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecalcService } from "../pricing/recalc.service";
import { TelegramService } from "../notifications/telegram.service";
import { WEEK_DAYS, type RecalcSchedule, type WeekDay } from "./recalc-schedule.types";

const DAY_LABELS: Record<WeekDay, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};

// Intl weekday "short" в en-US — "Mon".."Sun", ровно ключи WeekDay в нижнем регистре.
function currentClock(timeZone: string, date: Date): { day: WeekDay; time: string; dateKey: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: get("weekday").toLowerCase() as WeekDay,
    time: `${get("hour")}:${get("minute")}`,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/**
 * Раз в минуту проверяет recalcSchedule каждого маркетплейса и запускает recalcMarketplace,
 * если текущие день недели и время (в таймзоне SCHEDULER_TIMEZONE, по умолчанию UTC) совпадают
 * с включённой записью расписания. Дублирующий запуск в ту же минуту/день исключён через
 * lastFiredKey — при перезапуске сервера состояние сбрасывается, что на практике означает не более
 * одного лишнего запуска, если рестарт попадёт ровно на запланированную минуту.
 */
@Injectable()
export class RecalcSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecalcSchedulerService.name);
  private readonly timeZone = process.env.SCHEDULER_TIMEZONE || "UTC";
  private readonly lastFiredKey = new Map<string, string>();
  private alignTimer?: ReturnType<typeof setTimeout>;
  private tickTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly recalcService: RecalcService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
    this.alignTimer = setTimeout(() => {
      void this.tick();
      this.tickTimer = setInterval(() => void this.tick(), 60_000);
    }, msUntilNextMinute);
  }

  onModuleDestroy() {
    if (this.alignTimer) clearTimeout(this.alignTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  private async tick() {
    const { day, time, dateKey } = currentClock(this.timeZone, new Date());
    const fireKey = `${dateKey} ${time}`;

    let marketplaces: { id: string; name: string; recalcSchedule: unknown }[];
    try {
      marketplaces = await this.prisma.marketplace.findMany({ select: { id: true, name: true, recalcSchedule: true } });
    } catch (e) {
      this.logger.error(`Failed to load marketplaces for schedule check: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    for (const marketplace of marketplaces) {
      const schedule = (marketplace.recalcSchedule ?? {}) as RecalcSchedule;
      const entry = schedule[day];
      if (!entry?.enabled || entry.time !== time) continue;
      if (this.lastFiredKey.get(marketplace.id) === fireKey) continue;
      this.lastFiredKey.set(marketplace.id, fireKey);

      void this.runScheduledRecalc(marketplace.id, marketplace.name, day);
    }
  }

  private async runScheduledRecalc(marketplaceId: string, marketplaceName: string, day: WeekDay) {
    const label = `${DAY_LABELS[day]}`;
    try {
      const { productsCount } = await this.recalcService.recalcMarketplace(marketplaceId);
      this.logger.log(`Scheduled recalc done for "${marketplaceName}" (${label}): ${productsCount} products`);
      await this.telegram.sendMessage(
        `✅ Автопересчёт цен «${marketplaceName}» (${label})\nОбработано товаров: ${productsCount}`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`Scheduled recalc failed for "${marketplaceName}" (${label}): ${message}`);
      await this.telegram.sendMessage(`⚠️ Автопересчёт цен «${marketplaceName}» (${label}) завершился с ошибкой: ${message}`);
    }
  }
}
