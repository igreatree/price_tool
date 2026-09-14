import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconPlus, IconSearch, IconTrash, IconUpload } from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { notifications } from "@mantine/notifications";
import { productsApi } from "../../api/products";
import { supplierPricesApi } from "../../api/supplierPrices";
import type { SupplierPrice } from "../../types";
import { DataTable } from "../../components/DataTable";
import { ImportSupplierPricesModal } from "./ImportSupplierPricesModal";

interface SupplierRow extends SupplierPrice {
  productName: string;
  productExternalId: string;
}

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const { data: supplierPrices } = useQuery({ queryKey: ["supplierPrices"], queryFn: supplierPricesApi.list });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const [search, setSearch] = useState("");
  const [importOpened, setImportOpened] = useState(false);
  const [addOpened, setAddOpened] = useState(false);

  const productsById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const rows = useMemo<SupplierRow[]>(() => {
    if (!supplierPrices) return [];
    return supplierPrices.map((sp) => {
      const product = productsById.get(sp.productId);
      return { ...sp, productName: product?.name ?? "—", productExternalId: product?.externalId ?? sp.productId };
    });
  }, [supplierPrices, productsById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.productName.toLowerCase().includes(q) || r.productExternalId.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function invalidateAfterMutation() {
    await queryClient.invalidateQueries({ queryKey: ["supplierPrices"] });
    await queryClient.invalidateQueries({ queryKey: ["calculatedPrices"] });
  }

  async function handleDelete(row: SupplierRow) {
    await supplierPricesApi.remove(row.id);
    await invalidateAfterMutation();
  }

  const columns = useMemo<ColumnDef<SupplierRow, unknown>[]>(
    () => [
      { header: "ID товара", accessorKey: "productExternalId" },
      { header: "Товар", accessorKey: "productName" },
      { header: "Поставщик", accessorKey: "supplierName" },
      { header: "Цена", accessorKey: "price", cell: (info) => Number(info.getValue()).toLocaleString("ru-RU") },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Group justify="flex-end">
            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(row.original)} aria-label="Удалить">
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productsById],
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Цены поставщиков</Title>
        <Group>
          <Button leftSection={<IconUpload size={16} />} variant="default" onClick={() => setImportOpened(true)}>
            Импорт из Excel
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setAddOpened(true)}>
            Добавить цену
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Поиск по товару или поставщику"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      <Text size="sm" c="dimmed">
        Всего записей: {supplierPrices?.length ?? 0}
        {search ? `, найдено: ${filtered.length}` : ""}
      </Text>

      <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} height={620} />

      <Modal opened={importOpened} onClose={() => setImportOpened(false)} title="Импорт цен поставщиков из Excel" size="xl">
        <ImportSupplierPricesModal
          onDone={async () => {
            setImportOpened(false);
            await invalidateAfterMutation();
          }}
        />
      </Modal>

      <Modal opened={addOpened} onClose={() => setAddOpened(false)} title="Добавить цену поставщика">
        <AddSupplierPriceForm
          products={products ?? []}
          onSaved={async () => {
            setAddOpened(false);
            await invalidateAfterMutation();
          }}
        />
      </Modal>
    </Stack>
  );
}

function AddSupplierPriceForm({
  products,
  onSaved,
}: {
  products: { id: string; externalId: string; name: string }[];
  onSaved: () => void;
}) {
  const [productId, setProductId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [price, setPrice] = useState<number | string>("");

  const options = products.map((p) => ({ value: p.id, label: `${p.externalId} — ${p.name}` }));

  async function handleSubmit() {
    if (!productId || !supplierName.trim() || price === "") return;
    await supplierPricesApi.create({ productId, supplierName: supplierName.trim(), price: Number(price) || 0 });
    notifications.show({ message: "Цена поставщика добавлена", color: "green" });
    onSaved();
  }

  return (
    <Stack>
      <Select label="Товар" placeholder="Выберите товар" data={options} value={productId} onChange={setProductId} searchable required />
      <TextInput label="Поставщик" value={supplierName} onChange={(e) => setSupplierName(e.currentTarget.value)} required />
      <NumberInput label="Цена" min={0} decimalScale={2} value={price} onChange={setPrice} required />
      <Group justify="flex-end">
        <Button onClick={handleSubmit}>Сохранить</Button>
      </Group>
    </Stack>
  );
}
