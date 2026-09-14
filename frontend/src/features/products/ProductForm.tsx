import { useForm } from "@mantine/form";
import { ActionIcon, Button, Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { db } from "../../db/db";
import { createId } from "../../utils/id";
import type { Product } from "../../types";

interface ExtraFieldValue {
  key: string;
  value: string;
}

interface FormValues {
  externalId: string;
  name: string;
  brand: string;
  cost: number;
  extra: ExtraFieldValue[];
}

interface Props {
  product: Product | null;
  onSaved: (product: Product) => void;
}

export function ProductForm({ product, onSaved }: Props) {
  const form = useForm<FormValues>({
    initialValues: {
      externalId: product?.externalId ?? "",
      name: product?.name ?? "",
      brand: product?.brand ?? "",
      cost: product?.cost ?? 0,
      extra: product ? Object.entries(product.extra).map(([key, value]) => ({ key, value: String(value) })) : [],
    },
    validate: {
      externalId: (v) => (v.trim() ? null : "Обязательное поле"),
      name: (v) => (v.trim() ? null : "Обязательное поле"),
    },
  });

  async function handleSubmit(values: FormValues) {
    const externalId = values.externalId.trim();
    const existing = product ?? (await db.products.where("externalId").equals(externalId).first());

    const extra: Record<string, string | number> = {};
    for (const field of values.extra) {
      const key = field.key.trim();
      if (!key) continue;
      const rawValue = field.value.trim();
      const num = Number(rawValue);
      extra[key] = rawValue !== "" && Number.isFinite(num) ? num : rawValue;
    }

    const record: Product = {
      id: existing?.id ?? createId(),
      externalId,
      name: values.name.trim(),
      brand: values.brand.trim(),
      cost: Number(values.cost) || 0,
      extra,
      updatedAt: Date.now(),
    };

    await db.products.put(record);
    onSaved(record);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        <TextInput label="ID товара" required disabled={!!product} {...form.getInputProps("externalId")} />
        <TextInput label="Название" required {...form.getInputProps("name")} />
        <TextInput label="Бренд" {...form.getInputProps("brand")} />
        <NumberInput label="Себестоимость" min={0} decimalScale={2} {...form.getInputProps("cost")} />

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              Дополнительные параметры
            </Text>
            <ActionIcon
              variant="subtle"
              onClick={() => form.insertListItem("extra", { key: "", value: "" })}
              aria-label="Добавить параметр"
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Group>
          <Stack gap="xs">
            {form.values.extra.map((_, index) => (
              <Group key={index} wrap="nowrap">
                <TextInput placeholder="ключ, напр. size" style={{ flex: 1 }} {...form.getInputProps(`extra.${index}.key`)} />
                <TextInput placeholder="значение" style={{ flex: 1 }} {...form.getInputProps(`extra.${index}.value`)} />
                <ActionIcon variant="subtle" color="red" onClick={() => form.removeListItem("extra", index)} aria-label="Удалить параметр">
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
          <Text size="xs" c="dimmed" mt={4}>
            Ключ используется как имя переменной в условиях и формулах правил — используйте латиницу без пробелов.
          </Text>
        </div>

        <Group justify="flex-end" mt="md">
          <Button type="submit">Сохранить</Button>
        </Group>
      </Stack>
    </form>
  );
}
