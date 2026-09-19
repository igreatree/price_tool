export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type RuleScheduleAction = "enable" | "disable";

export interface RuleScheduleEntry {
  action: RuleScheduleAction;
  /** "HH:MM", 24-часовой формат, в таймзоне SCHEDULER_TIMEZONE (см. RuleSchedulerService). */
  time: string;
}

/** День, отсутствующий в объекте (или null), не управляется расписанием — enabled в этот день
 * не трогается автоматически. */
export type RuleSchedule = Partial<Record<WeekDay, RuleScheduleEntry | null>>;

export const WEEK_DAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
