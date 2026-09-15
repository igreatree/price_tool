import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Badge, Button, Drawer, Group, MultiSelect, NumberInput, SegmentedControl, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { notifications } from "@mantine/notifications";
import { expensesApi } from "../../api/expenses";
import { productsApi } from "../../api/products";
import type { Expense } from "../../types";
import { DataTable } from "../../components/DataTable";

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const { data: expenses, isLoading } = useQuery({ queryKey: ["expenses"], queryFn: expensesApi.list });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const [editing, setEditing] = useState<Expense | null>(null);
  const [opened, setOpened] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function invalidateAfterMutation() {
    await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    await queryClient.invalidateQueries({ queryKey: ["calculatedPrices"] });
  }

  async function handleDelete(expense: Expense) {
    if (!confirm(`Удалить расход "${expense.name}"?`)) return;
    setDeletingId(expense.id);
    try {
      await expensesApi.remove(expense.id);
      notifications.show({ message: "Расход удалён. Цены пересчитаны.", color: "green" });
      await invalidateAfterMutation();
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<ColumnDef<Expense, unknown>[]>(
    () => [
      { header: "Название", accessorKey: "name" },
      { header: "Тип", accessorKey: "type", cell: (info) => (info.getValue() === "fixed" ? "Фикс., ₽" : "% от себестоимости") },
      { header: "Значение", accessorKey: "value" },
      {
        header: "Применяется",
        id: "scope",
        cell: ({ row }) =>
          row.original.appliesToAll ? (
            <Badge color="gray">Все товары</Badge>
          ) : (
            <Badge color="indigo">{row.original.productIds.length} товар(ов)</Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Group justify="flex-end">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setEditing(row.original);
                setOpened(true);
              }}
              aria-label="Редактировать"
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              loading={deletingId === row.original.id}
              onClick={() => handleDelete(row.original)}
              aria-label="Удалить"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ),
      },
    ],
    [deletingId],
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Расходы</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setEditing(null);
            setOpened(true);
          }}
        >
          Добавить расход
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        Общие расходы, не привязанные к конкретному маркетплейсу — учитываются в переменной <code>expensesTotal</code>, доступной в формулах
        правил.
      </Text>

      <DataTable data={expenses ?? []} columns={columns} getRowId={(e) => e.id} height={500} loading={isLoading} />

      <Drawer opened={opened} onClose={() => setOpened(false)} title={editing ? "Редактирование расхода" : "Новый расход"} position="right" size="md">
        <ExpenseForm
          expense={editing}
          products={products ?? []}
          onSaved={async () => {
            setOpened(false);
            notifications.show({ message: "Расход сохранён. Цены пересчитаны.", color: "green" });
            await invalidateAfterMutation();
          }}
        />
      </Drawer>
    </Stack>
  );
}

function ExpenseForm({
  expense,
  products,
  onSaved,
}: {
  expense: Expense | null;
  products: { id: string; externalId: string; name: string }[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(expense?.name ?? "");
  const [type, setType] = useState<Expense["type"]>(expense?.type ?? "fixed");
  const [value, setValue] = useState<number | string>(expense?.value ?? 0);
  const [appliesToAll, setAppliesToAll] = useState(expense?.appliesToAll ?? true);
  const [productIds, setProductIds] = useState<string[]>(expense?.productIds ?? []);
  const [saving, setSaving] = useState(false);

  const options = products.map((p) => ({ value: p.id, label: `${p.externalId} — ${p.name}` }));

  async function handleSubmit() {
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      type,
      value: Number(value) || 0,
      appliesToAll,
      productIds: appliesToAll ? [] : productIds,
    };
    setSaving(true);
    try {
      if (expense) {
        await expensesApi.update(expense.id, input);
      } else {
        await expensesApi.create(input);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack>
      <TextInput label="Название" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <SegmentedControl
        value={type}
        onChange={(v) => setType(v as Expense["type"])}
        data={[
          { label: "Фиксированная, ₽", value: "fixed" },
          { label: "% от себестоимости", value: "percent" },
        ]}
      />
      <NumberInput label="Значение" value={value} onChange={setValue} min={0} decimalScale={2} />
      <Switch label="Применяется ко всем товарам" checked={appliesToAll} onChange={(e) => setAppliesToAll(e.currentTarget.checked)} />
      {!appliesToAll && <MultiSelect label="Товары" data={options} value={productIds} onChange={setProductIds} searchable clearable />}
      <Group justify="flex-end">
        <Button onClick={handleSubmit} loading={saving}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
