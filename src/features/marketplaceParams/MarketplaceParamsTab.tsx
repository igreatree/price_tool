import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconSearch, IconUpload } from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { db } from "../../db/db";
import type { Marketplace, MarketplaceProductParams, Product } from "../../types";
import { DataTable } from "../../components/DataTable";
import { EditableNumberCell } from "../../components/EditableNumberCell";
import { createId } from "../../utils/id";
import { recalcProductForMarketplace } from "../../engine/recalcService";
import { ImportMarketplaceParamsModal } from "./ImportMarketplaceParamsModal";

interface Row {
  product: Product;
  params: MarketplaceProductParams | undefined;
}

type NumericField = "discount" | "taxRate" | "commissionRate" | "logistics" | "ads" | "otherExpenses";

export function MarketplaceParamsTab({ marketplace }: { marketplace: Marketplace }) {
  const products = useLiveQuery(() => db.products.toArray(), []);
  const paramsList = useLiveQuery(
    () => db.marketplaceProductParams.where("marketplaceId").equals(marketplace.id).toArray(),
    [marketplace.id],
  );
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
    const record: MarketplaceProductParams = {
      id: row.params?.id ?? createId(),
      productId: row.product.id,
      marketplaceId: marketplace.id,
      discount: row.params?.discount ?? 0,
      taxRate: row.params?.taxRate ?? 0,
      commissionRate: row.params?.commissionRate ?? 0,
      logistics: row.params?.logistics ?? 0,
      ads: row.params?.ads ?? 0,
      otherExpenses: row.params?.otherExpenses ?? 0,
      updatedAt: Date.now(),
      [field]: value,
    };
    await db.marketplaceProductParams.put(record);
    await recalcProductForMarketplace(row.product, marketplace);
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
        <ImportMarketplaceParamsModal marketplace={marketplace} onDone={() => setImportOpened(false)} />
      </Modal>
    </Stack>
  );
}
