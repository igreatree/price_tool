export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface RecalcScheduleDay {
  enabled: boolean;
  /** "HH:MM", 24-часовой формат, в таймзоне SCHEDULER_TIMEZONE (см. RecalcSchedulerService). */
  time: string;
}

/** День, отсутствующий в объекте, считается выключенным — так старые маркетплейсы с recalcSchedule
 * по умолчанию "{}" (см. миграцию 20260918130000_recalc_schedule) просто ничего не планируют. */
export type RecalcSchedule = Partial<Record<WeekDay, RecalcScheduleDay>>;

export const WEEK_DAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
