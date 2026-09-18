import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Group, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { marketplacesApi } from "../../api/marketplaces";
import type { Marketplace, RecalcScheduleDay, WeekDay } from "../../types";

const WEEK_DAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<WeekDay, string> = { mon: "Пн", tue: "Вт", wed: "Ср", thu: "Чт", fri: "Пт", sat: "Сб", sun: "Вс" };
const DEFAULT_DAY: RecalcScheduleDay = { enabled: false, time: "09:00" };

function normalize(schedule: Marketplace["recalcSchedule"]): Record<WeekDay, RecalcScheduleDay> {
  const result = {} as Record<WeekDay, RecalcScheduleDay>;
  for (const day of WEEK_DAYS) result[day] = schedule[day] ?? { ...DEFAULT_DAY };
  return result;
}

export function RecalcScheduleCard({ marketplace }: { marketplace: Marketplace }) {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<Record<WeekDay, RecalcScheduleDay>>(() => normalize(marketplace.recalcSchedule));
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(() => WEEK_DAYS.filter((d) => schedule[d].enabled).length, [schedule]);

  function updateDay(day: WeekDay, patch: Partial<RecalcScheduleDay>) {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await marketplacesApi.updateSchedule(marketplace.id, schedule);
      await queryClient.invalidateQueries({ queryKey: ["marketplaces", marketplace.id] });
      notifications.show({ message: "Расписание автопересчёта сохранено.", color: "green" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={5}>Автопересчёт по расписанию</Title>
          <Text size="xs" c="dimmed">
            {activeCount > 0 ? `Дней в неделю: ${activeCount}` : "Выключено"}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          В выбранные дни и время «Пересчитать всё» для этого маркетплейса будет запускаться автоматически. Время — по часовому
          поясу сервера.
        </Text>

        <Stack gap={6}>
          {WEEK_DAYS.map((day) => (
            <Group key={day} wrap="nowrap">
              <Switch
                checked={schedule[day].enabled}
                onChange={(e) => updateDay(day, { enabled: e.currentTarget.checked })}
                label={DAY_LABELS[day]}
                w={90}
              />
              <TextInput
                type="time"
                value={schedule[day].time}
                onChange={(e) => updateDay(day, { time: e.currentTarget.value || DEFAULT_DAY.time })}
                disabled={!schedule[day].enabled}
                w={140}
              />
            </Group>
          ))}
        </Stack>

        <Group justify="flex-end">
          <Button onClick={handleSave} loading={saving} size="xs" variant="default">
            Сохранить расписание
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
