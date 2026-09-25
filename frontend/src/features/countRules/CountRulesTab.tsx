import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Badge, Button, Center, Drawer, Group, Loader, Modal, Stack, Switch, Text } from "@mantine/core";
import { IconDownload, IconPencil, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { countRulesApi } from "../../api/countRules";
import type { CountRule, Marketplace } from "../../types";
import { CountRuleForm } from "./CountRuleForm";
import { ImportCountRulesModal } from "./ImportCountRulesModal";
import { conditionGroupToExpression } from "../../engine/conditionBuilder";
import { exportRowsToExcel } from "../../utils/excel";
import { COUNT_RULE_SHEET_COLUMNS } from "./countRuleSheetColumns";

export function CountRulesTab({ marketplace }: { marketplace: Marketplace }) {
  const queryClient = useQueryClient();
  const { data: rules, isLoading } = useQuery({
    queryKey: ["countRules", marketplace.id],
    queryFn: () => countRulesApi.listByMarketplace(marketplace.id),
  });
  const [editing, setEditing] = useState<CountRule | null>(null);
  const [opened, setOpened] = useState(false);
  const [importOpened, setImportOpened] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function invalidateAfterMutation() {
    await queryClient.invalidateQueries({ queryKey: ["countRules", marketplace.id] });
  }

  async function handleDelete(rule: CountRule) {
    if (!confirm(`Удалить правило "${rule.name}"?`)) return;
    setDeletingId(rule.id);
    try {
      await countRulesApi.remove(rule.id);
      notifications.show({ message: "Правило удалено. Не забудьте нажать «Рассчитать остаток», чтобы обновить остатки.", color: "green" });
      await invalidateAfterMutation();
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleEnabled(rule: CountRule, enabled: boolean) {
    setTogglingId(rule.id);
    try {
      await countRulesApi.patch(rule.id, { enabled });
      await invalidateAfterMutation();
    } finally {
      setTogglingId(null);
    }
  }

  function handleExport() {
    const exportRows = (rules ?? []).map((rule) => ({
      [COUNT_RULE_SHEET_COLUMNS.name]: rule.name,
      [COUNT_RULE_SHEET_COLUMNS.priority]: rule.priority,
      [COUNT_RULE_SHEET_COLUMNS.enabled]: rule.enabled,
      [COUNT_RULE_SHEET_COLUMNS.condition]: conditionGroupToExpression(rule.conditionGroup) || rule.rawCondition || "",
      [COUNT_RULE_SHEET_COLUMNS.script]: rule.script,
      [COUNT_RULE_SHEET_COLUMNS.isFinal]: rule.isFinal,
    }));
    exportRowsToExcel("Правила остатков", exportRows, `${marketplace.name}_правила_остатков.xlsx`);
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Правила проверяются по возрастанию приоритета — у первого подошедшего скрипт вычисляет остаток товара. Если правило не
          финальное, каскад продолжается со следующим подходящим правилом, которому передаётся результат этого правила через
          prevCount. Если ни одно правило не подошло — остаток равен 0. Ручные изменения правил не пересчитывают остатки
          автоматически — нажмите «Рассчитать остаток» на вкладке «Расчёт», когда закончите редактировать.
        </Text>
        <Group>
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            onClick={handleExport}
            disabled={!rules || rules.length === 0}
          >
            Экспорт
          </Button>
          <Button variant="default" leftSection={<IconUpload size={16} />} onClick={() => setImportOpened(true)}>
            Импорт
          </Button>
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
      </Group>

      {isLoading && (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      )}

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
                {!rule.isFinal && (
                  <Badge variant="light" color="grape">
                    каскадное
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" mt={2}>
                {conditionGroupToExpression(rule.conditionGroup) || rule.rawCondition || "без условия (всегда)"}
              </Text>
            </div>
            <Group>
              <Switch
                checked={rule.enabled}
                disabled={togglingId === rule.id}
                onChange={(e) => toggleEnabled(rule, e.currentTarget.checked)}
                label="Активно"
              />
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
              <ActionIcon
                variant="subtle"
                color="red"
                loading={deletingId === rule.id}
                onClick={() => handleDelete(rule)}
                aria-label="Удалить"
              >
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
        <CountRuleForm
          marketplace={marketplace}
          rule={editing}
          onSaved={async () => {
            setOpened(false);
            notifications.show({ message: "Правило сохранено. Не забудьте нажать «Рассчитать остаток», чтобы обновить остатки.", color: "green" });
            await invalidateAfterMutation();
          }}
        />
      </Drawer>

      <Modal opened={importOpened} onClose={() => setImportOpened(false)} title={`Импорт правил остатков для «${marketplace.name}»`} size="lg">
        <ImportCountRulesModal
          marketplace={marketplace}
          onDone={async () => {
            setImportOpened(false);
            await invalidateAfterMutation();
          }}
        />
      </Modal>
    </Stack>
  );
}
