import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconSearch, IconUpload } from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { productsApi } from "../../api/products";
import { marketplaceParamsApi, type ParamsFieldsInput } from "../../api/marketplaceParams";
import type { Marketplace, MarketplaceProductParams, Product } from "../../types";
import { DataTable } from "../../components/DataTable";
import { EditableNumberCell } from "../../components/EditableNumberCell";
import { ImportMarketplaceParamsModal } from "./ImportMarketplaceParamsModal";

interface Row {
  product: Product;
  params: MarketplaceProductParams | undefined;
}

type NumericField = "discount" | "taxRate" | "commissionRate" | "logistics" | "ads" | "otherExpenses";

export function MarketplaceParamsTab({ marketplace }: { marketplace: Marketplace }) {
  const queryClient = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: paramsList } = useQuery({
    queryKey: ["marketplaceParams", marketplace.id],
    queryFn: () => marketplaceParamsApi.listByMarketplace(marketplace.id),
  });
  const [search, setSearch] = useState("");
  const [importOpened, setImportOpened] = useState(false);

  const paramsByProduct = useMemo(() => new Map((paramsList ?? []).map((p) => [p.productId, p])), [paramsList]);

  const rows = useMemo<Row[]>(
    () => (products ?? []).map((product) => ({ product, params: paramsByProduct.get(product.id) })),
    [products, paramsByProduct],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.product.name.toLowerCase().includes(q) || r.product.externalId.toLowerCase().includes(q));
  }, [rows, search]);

  async function saveField(row: Row, field: NumericField, value: number) {
    const fields: ParamsFieldsInput = { [field]: value };
    await marketplaceParamsApi.upsertField(marketplace.id, row.product.id, fields);
    await queryClient.invalidateQueries({ queryKey: ["marketplaceParams", marketplace.id] });
    await queryClient.invalidateQueries({ queryKey: ["calculatedPrices", marketplace.id] });
  }

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { header: "ID товара", accessorFn: (r) => r.product.externalId, id: "externalId" },
      { header: "Товар", accessorFn: (r) => r.product.name, id: "name" },
      {
        header: "Скидка (СПП)",
        id: "discount",
        cell: ({ row }) => (
          <EditableNumberCell value={row.original.params?.discount ?? 0} onCommit={(v) => saveField(row.original, "discount", v)} />
        ),
      },
      {
        header: "Налог",
        id: "taxRate",
        cell: ({ row }) => (
          <EditableNumberCell value={row.original.params?.taxRate ?? 0} onCommit={(v) => saveField(row.original, "taxRate", v)} />
        ),
      },
      {
        header: "Комиссия",
        id: "commissionRate",
        cell: ({ row }) => (
          <EditableNumberCell value={row.original.params?.commissionRate ?? 0} onCommit={(v) => saveField(row.original, "commissionRate", v)} />
        ),
      },
      {
        header: "Логистика, ₽",
        id: "logistics",
        cell: ({ row }) => (
          <EditableNumberCell value={row.original.params?.logistics ?? 0} onCommit={(v) => saveField(row.original, "logistics", v)} />
        ),
      },
      {
        header: "Реклама, ₽",
        id: "ads",
        cell: ({ row }) => <EditableNumberCell value={row.original.params?.ads ?? 0} onCommit={(v) => saveField(row.original, "ads", v)} />,
      },
      {
        header: "Доп. расходы, ₽",
        id: "otherExpenses",
        cell: ({ row }) => (
          <EditableNumberCell value={row.original.params?.otherExpenses ?? 0} onCommit={(v) => saveField(row.original, "otherExpenses", v)} />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketplace.id],
  );

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Text size="sm" c="dimmed" maw={640}>
          Скидка и налог — доли от 1 (0.15 = 15%), комиссия — доля от цены (0.415 = 41.5%). Логистика/реклама/доп. расходы — в рублях за
          единицу товара. Эти значения используются как переменные <code>discount/taxRate/commissionRate/logistics/ads/otherExpenses</code> в
          формулах правил.
        </Text>
        <Button leftSection={<IconUpload size={16} />} variant="default" onClick={() => setImportOpened(true)}>
          Импорт из Excel
        </Button>
      </Group>

      <TextInput
        placeholder="Поиск по товару или ID"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      <DataTable data={filtered} columns={columns} getRowId={(r) => r.product.id} height={560} rowHeight={52} />

      <Modal opened={importOpened} onClose={() => setImportOpened(false)} title={`Импорт параметров для «${marketplace.name}»`} size="xl">
        <ImportMarketplaceParamsModal
          marketplace={marketplace}
          onDone={async () => {
            setImportOpened(false);
            await queryClient.invalidateQueries({ queryKey: ["marketplaceParams", marketplace.id] });
            await queryClient.invalidateQueries({ queryKey: ["calculatedPrices", marketplace.id] });
          }}
        />
      </Modal>
    </Stack>
  );
}
