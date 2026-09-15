import { useRef } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollArea, Table, Text, Center, Loader } from "@mantine/core";

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  height?: number;
  rowHeight?: number;
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyLabel?: string;
  loading?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  height = 560,
  rowHeight = 44,
  getRowId,
  onRowClick,
  emptyLabel = "Нет данных",
  loading = false,
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId as ((row: T, index: number) => string) | undefined,
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <ScrollArea.Autosize mah={height} viewportRef={scrollRef} type="always" offsetScrollbars>
      <Table striped highlightOnHover stickyHeader withTableBorder verticalSpacing="xs">
        <Table.Thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Table.Th key={header.id} style={{ whiteSpace: "nowrap" }}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {loading && (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Center py="lg">
                  <Loader size="sm" />
                </Center>
              </Table.Td>
            </Table.Tr>
          )}
          {!loading && rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Center py="lg">
                  <Text c="dimmed" size="sm">
                    {emptyLabel}
                  </Text>
                </Center>
              </Table.Td>
            </Table.Tr>
          )}
          {paddingTop > 0 && (
            <tr>
              <td colSpan={columns.length} style={{ height: paddingTop, padding: 0, border: "none" }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <Table.Tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                style={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Td>
                ))}
              </Table.Tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td colSpan={columns.length} style={{ height: paddingBottom, padding: 0, border: "none" }} />
            </tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea.Autosize>
  );
}
