import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecalcService } from "../pricing/recalc.service";
import { TelegramService } from "../notifications/telegram.service";
import type { RuleSchedule, WeekDay } from "./rule-schedule.types";

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

interface RuleChange {
  ruleName: string;
  action: "enable" | "disable";
}

/**
 * Раз в минуту проверяет schedule каждого правила и включает/выключает его, если текущие день
 * недели и время (в таймзоне SCHEDULER_TIMEZONE, по умолчанию UTC) совпадают с записью расписания
 * на сегодня. После переключений в рамках одного тика — по одному разу на маркетплейс —
 * запускает recalcMarketplace (как кнопка «Пересчитать всё») и шлёт итог в Telegram.
 * Повторное срабатывание в ту же минуту/день исключено через lastFiredKey — при перезапуске
 * сервера состояние сбрасывается, это на практике не более одного лишнего запуска, если рестарт
 * попадёт ровно на запланированную минуту.
 */
@Injectable()
export class RuleSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RuleSchedulerService.name);
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

    let rules: { id: string; name: string; enabled: boolean; marketplaceId: string; schedule: unknown }[];
    try {
      rules = await this.prisma.rule.findMany({
        select: { id: true, name: true, enabled: true, marketplaceId: true, schedule: true },
      });
    } catch (e) {
      this.logger.error(`Failed to load rules for schedule check: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const changesByMarketplace = new Map<string, RuleChange[]>();

    for (const rule of rules) {
      const schedule = (rule.schedule ?? {}) as RuleSchedule;
      const entry = schedule[day];
      if (!entry || entry.time !== time) continue;
      if (this.lastFiredKey.get(rule.id) === fireKey) continue;
      this.lastFiredKey.set(rule.id, fireKey);

      const targetEnabled = entry.action === "enable";
      if (rule.enabled === targetEnabled) continue;

      try {
        await this.prisma.rule.update({ where: { id: rule.id }, data: { enabled: targetEnabled } });
      } catch (e) {
        this.logger.error(`Failed to toggle rule "${rule.name}": ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      const list = changesByMarketplace.get(rule.marketplaceId) ?? [];
      list.push({ ruleName: rule.name, action: entry.action });
      changesByMarketplace.set(rule.marketplaceId, list);
    }

    for (const [marketplaceId, changes] of changesByMarketplace) {
      void this.recalcAndNotify(marketplaceId, changes, day);
    }
  }

  private async recalcAndNotify(marketplaceId: string, changes: RuleChange[], day: WeekDay) {
    const enabled = changes.filter((c) => c.action === "enable").map((c) => c.ruleName);
    const disabled = changes.filter((c) => c.action === "disable").map((c) => c.ruleName);
    const marketplace = await this.prisma.marketplace.findUnique({ where: { id: marketplaceId }, select: { name: true } });
    const marketplaceName = marketplace?.name ?? marketplaceId;
    const label = DAY_LABELS[day];

    const lines = [`🔁 Расписание правил «${marketplaceName}» (${label})`];
    if (enabled.length) lines.push(`Включены: ${enabled.join(", ")}`);
    if (disabled.length) lines.push(`Выключены: ${disabled.join(", ")}`);

    try {
      const { productsCount } = await this.recalcService.recalcMarketplace(marketplaceId);
      lines.push(`Цены пересчитаны, товаров: ${productsCount}`);
      this.logger.log(lines.join(" | "));
      await this.telegram.sendMessage(lines.join("\n"));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      lines.push(`⚠️ Ошибка пересчёта цен: ${message}`);
      this.logger.error(lines.join(" | "));
      await this.telegram.sendMessage(lines.join("\n"));
    }
  }
}
