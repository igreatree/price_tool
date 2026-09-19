import type { RuleSchedule, RuleScheduleEntry, WeekDay } from "../../types";

export const WEEK_DAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS: Record<WeekDay, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};

export const DEFAULT_SCHEDULE_TIME = "09:00";

export function hasActiveSchedule(schedule: RuleSchedule): boolean {
  return WEEK_DAYS.some((day) => schedule[day]);
}

export function scheduleSummary(schedule: RuleSchedule): string {
  return WEEK_DAYS.filter((day) => schedule[day])
    .map((day) => {
      const entry = schedule[day] as RuleScheduleEntry;
      return `${DAY_LABELS[day]} ${entry.time} → ${entry.action === "enable" ? "вкл" : "выкл"}`;
    })
    .join(", ");
}
