import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ActionIcon, Badge, Button, Drawer, Group, Stack, Switch, Text } from "@mantine/core";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { db } from "../../db/db";
import type { Marketplace, Rule } from "../../types";
import { RuleForm } from "./RuleForm";
import { recalcMarketplace } from "../../engine/recalcService";
import { conditionGroupToExpression } from "../../engine/conditionBuilder";

export function RulesTab({ marketplace }: { marketplace: Marketplace }) {
  const rules = useLiveQuery(() => db.rules.where("marketplaceId").equals(marketplace.id).sortBy("priority"), [marketplace.id]);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [opened, setOpened] = useState(false);

  async function handleDelete(rule: Rule) {
    if (!confirm(`Удалить правило "${rule.name}"?`)) return;
    await db.rules.delete(rule.id);
    notifications.show({ message: "Правило удалено. Пересчитываем цены...", color: "blue" });
    await recalcMarketplace(marketplace);
    notifications.show({ message: "Пересчёт завершён", color: "green" });
  }

  async function toggleEnabled(rule: Rule, enabled: boolean) {
    await db.rules.update(rule.id, { enabled });
    await recalcMarketplace(marketplace);
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Правила проверяются по возрастанию приоритета — применяется первое подошедшее.
        </Text>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setEditing(null);
            setOpened(true);
          }}
        >
          Добавить правило
        </Button>
      </Group>

      <Stack gap="xs">
        {(rules ?? []).map((rule) => (
          <Group
            key={rule.id}
            justify="space-between"
            p="sm"
            style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-md)" }}
          >
            <div>
              <Group gap="xs">
                <Text fw={600}>{rule.name}</Text>
                <Badge variant="light">приоритет {rule.priority}</Badge>
              </Group>
              <Text size="xs" c="dimmed" mt={2}>
                {conditionGroupToExpression(rule.conditionGroup) || rule.rawCondition || "без условия (всегда)"}
              </Text>
            </div>
            <Group>
              <Switch checked={rule.enabled} onChange={(e) => toggleEnabled(rule, e.currentTarget.checked)} label="Активно" />
              <ActionIcon
                variant="subtle"
                onClick={() => {
                  setEditing(rule);
                  setOpened(true);
                }}
                aria-label="Редактировать"
              >
                <IconPencil size={16} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(rule)} aria-label="Удалить">
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
        {rules && rules.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            Правил пока нет.
          </Text>
        )}
      </Stack>

      <Drawer opened={opened} onClose={() => setOpened(false)} title={editing ? "Редактирование правила" : "Новое правило"} position="right" size="lg">
        <RuleForm
          marketplace={marketplace}
          rule={editing}
          onSaved={async () => {
            setOpened(false);
            notifications.show({ message: "Правило сохранено. Пересчитываем цены...", color: "blue" });
            await recalcMarketplace(marketplace);
            notifications.show({ message: "Пересчёт завершён", color: "green" });
          }}
        />
      </Drawer>
    </Stack>
  );
}
