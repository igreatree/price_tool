import { ActionIcon, Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { ConditionGroup, ConditionOperator, ConditionRow } from "../../types";
import { emptyConditionRow } from "../../engine/conditionBuilder";

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "==", label: "=" },
  { value: "!=", label: "≠" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: "≥" },
  { value: "<=", label: "≤" },
];

interface Props {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  fieldSuggestions?: string[];
}

export function ConditionBuilder({ group, onChange, fieldSuggestions = [] }: Props) {
  function updateRow(index: number, patch: Partial<ConditionRow>) {
    onChange({ ...group, rows: group.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  }

  return (
    <Stack gap="xs">
      <datalist id="condition-field-suggestions">
        {fieldSuggestions.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {group.rows.map((row, index) => (
        <Group key={row.id} wrap="nowrap" align="center">
          {index > 0 ? (
            <Select
              data={[
                { value: "AND", label: "И" },
                { value: "OR", label: "ИЛИ" },
              ]}
              value={group.joiner}
              onChange={(v) => onChange({ ...group, joiner: (v as ConditionGroup["joiner"]) ?? "AND" })}
              w={90}
              allowDeselect={false}
            />
          ) : (
            <div style={{ width: 90 }} />
          )}
          <TextInput
            placeholder="поле, напр. brand"
            list="condition-field-suggestions"
            style={{ flex: 1 }}
            value={row.field}
            onChange={(e) => updateRow(index, { field: e.currentTarget.value })}
          />
          <Select
            data={OPERATORS}
            value={row.operator}
            onChange={(v) => updateRow(index, { operator: (v as ConditionOperator) ?? "==" })}
            w={80}
            allowDeselect={false}
          />
          <TextInput
            placeholder="значение"
            style={{ flex: 1 }}
            value={row.value}
            onChange={(e) => updateRow(index, { value: e.currentTarget.value })}
          />
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => onChange({ ...group, rows: group.rows.filter((_, i) => i !== index) })}
            aria-label="Удалить условие"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}

      <Button
        variant="light"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={() => onChange({ ...group, rows: [...group.rows, emptyConditionRow()] })}
        style={{ alignSelf: "flex-start" }}
      >
        Добавить условие
      </Button>
    </Stack>
  );
}
