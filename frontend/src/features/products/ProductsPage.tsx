import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Button, Drawer, Group, Modal, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconPencil, IconPlus, IconSearch, IconTrash, IconUpload } from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { notifications } from "@mantine/notifications";
import { productsApi } from "../../api/products";
import type { Product } from "../../types";
import { DataTable } from "../../components/DataTable";
import { ProductForm } from "./ProductForm";
import { ImportProductsModal } from "./ImportProductsModal";

export function ProductsPage() {
  const queryClient = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpened, setFormOpened] = useState(false);
  const [importOpened, setImportOpened] = useState(false);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.externalId.toLowerCase().includes(q),
    );
  }, [products, search]);

  async function handleDelete(product: Product) {
    if (!confirm(`Удалить товар "${product.name}"?`)) return;
    await productsApi.remove(product.id);
    await queryClient.invalidateQueries({ queryKey: ["products"] });
    await queryClient.invalidateQueries({ queryKey: ["calculatedPrices"] });
  }

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      { header: "ID товара", accessorKey: "externalId" },
      { header: "Название", accessorKey: "name" },
      { header: "Бренд", accessorKey: "brand" },
      {
        header: "Себестоимость",
        accessorKey: "cost",
        cell: (info) => Number(info.getValue()).toLocaleString("ru-RU"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setEditing(row.original);
                setFormOpened(true);
              }}
              aria-label="Редактировать"
            >
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(row.original)} aria-label="Удалить">
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ),
      },
    ],
    [],
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Товары</Title>
        <Group>
          <Button leftSection={<IconUpload size={16} />} variant="default" onClick={() => setImportOpened(true)}>
            Импорт из Excel
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              setFormOpened(true);
            }}
          >
            Добавить товар
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Поиск по названию, бренду или ID"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      <Text size="sm" c="dimmed">
        Всего товаров: {products?.length ?? 0}
        {search ? `, найдено: ${filtered.length}` : ""}
      </Text>

      <DataTable data={filtered} columns={columns} getRowId={(p) => p.id} height={620} />

      <Drawer
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        title={editing ? "Редактирование товара" : "Новый товар"}
        position="right"
        size="md"
      >
        <ProductForm
          product={editing}
          onSaved={async () => {
            setFormOpened(false);
            await queryClient.invalidateQueries({ queryKey: ["products"] });
            await queryClient.invalidateQueries({ queryKey: ["calculatedPrices"] });
            notifications.show({ message: "Товар сохранён, цены пересчитаны", color: "green" });
          }}
        />
      </Drawer>

      <Modal opened={importOpened} onClose={() => setImportOpened(false)} title="Импорт товаров из Excel" size="xl">
        <ImportProductsModal
          onDone={async () => {
            setImportOpened(false);
            await queryClient.invalidateQueries({ queryKey: ["products"] });
            await queryClient.invalidateQueries({ queryKey: ["calculatedPrices"] });
          }}
        />
      </Modal>
    </Stack>
  );
}
