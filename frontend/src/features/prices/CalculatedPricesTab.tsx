import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Group, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconDownload, IconRefresh, IconSearch } from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { notifications } from "@mantine/notifications";
import { calculatedPricesApi } from "../../api/calculatedPrices";
import { productsApi } from "../../api/products";
import { rulesApi } from "../../api/rules";
import type { CalculatedPrice, Marketplace, Product } from "../../types";
import { DataTable } from "../../components/DataTable";
import { exportRowsToExcel } from "../../utils/excel";

interface Row extends CalculatedPrice {
  product: Product | undefined;
  ruleName: string;
}

export function CalculatedPricesTab({ marketplace }: { marketplace: Marketplace }) {
  const queryClient = useQueryClient();
  const { data: calculatedPrices, isLoading } = useQuery({
    queryKey: ["calculatedPrices", marketplace.id],
    queryFn: () => calculatedPricesApi.listByMarketplace(marketplace.id),
  });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: rules } = useQuery({ queryKey: ["rules", marketplace.id], queryFn: () => rulesApi.listByMarketplace(marketplace.id) });
  const [search, setSearch] = useState("");
  const [recalculating, setRecalculating] = useState(false);

  const productsById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const rulesById = useMemo(() => new Map((rules ?? []).map((r) => [r.id, r])), [rules]);

  const rows = useMemo<Row[]>(
    () =>
      (calculatedPrices ?? []).map((cp) => {
        const chainIds = cp.appliedRuleIds.length ? cp.appliedRuleIds : cp.appliedRuleId ? [cp.appliedRuleId] : [];
        return {
          ...cp,
          product: productsById.get(cp.productId),
          ruleName: chainIds.length ? chainIds.map((id) => rulesById.get(id)?.name ?? "—").join(" → ") : "—",
        };
      }),
    [calculatedPrices, productsById, rulesById],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.product?.name.toLowerCase().includes(q) || r.product?.externalId.toLowerCase().includes(q));
  }, [rows, search]);

  async function handleRecalc() {
    setRecalculating(true);
    try {
      await calculatedPricesApi.recalculate(marketplace.id);
      await queryClient.invalidateQueries({ queryKey: ["calculatedPrices", marketplace.id] });
      notifications.show({ message: "Пересчёт завершён", color: "green" });
    } finally {
      setRecalculating(false);
    }
  }

  function handleExport() {
    const exportRows = rows
      .filter((r) => r.product)
      .map((r) => ({
        "ID товара": r.product!.externalId,
        Название: r.product!.name,
        Цена: r.price,
        "Чистая выручка": r.netProceeds,
        X: r.marginRatio,
        Предупреждения: r.warnings.join("; "),
      }));
    exportRowsToExcel(marketplace.name, exportRows, `${marketplace.name}_цены.xlsx`);
  }

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { header: "ID товара", accessorFn: (r) => r.product?.externalId ?? r.productId, id: "externalId" },
      { header: "Товар", accessorFn: (r) => r.product?.name ?? "—", id: "name" },
      { header: "Цена", accessorKey: "price", cell: (info) => Number(info.getValue()).toLocaleString("ru-RU") },
      { header: "Выручка", accessorKey: "netProceeds", cell: (info) => Number(info.getValue()).toFixed(2) },
      { header: "X", accessorKey: "marginRatio", cell: (info) => Number(info.getValue()).toFixed(3) },
      { header: "Правило", accessorKey: "ruleName" },
      {
        header: "Предупреждения",
        id: "warnings",
        cell: ({ row }) =>
          row.original.warnings.length ? (
            <Tooltip label={row.original.warnings.join("; ")} multiline w={280}>
              <Badge color="yellow">{row.original.warnings.length}</Badge>
            </Tooltip>
          ) : null,
      },
    ],
    [],
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Рассчитано товаров: {calculatedPrices?.length ?? 0} из {products?.length ?? 0}
        </Text>
        <Group>
          <Button variant="default" leftSection={<IconDownload size={16} />} onClick={handleExport} disabled={rows.length === 0}>
            Экспорт в Excel
          </Button>
          <Button leftSection={<IconRefresh size={16} />} onClick={handleRecalc} loading={recalculating}>
            Пересчитать всё
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Поиск по товару"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} height={560} loading={isLoading} />
    </Stack>
  );
}
