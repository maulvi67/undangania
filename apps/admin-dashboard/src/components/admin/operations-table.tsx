import type { ReactNode } from "react";
import { Table, TableBody, TableHeader } from "../ui/table";


type TableColumn<T> = { key: string; label: string; render: (row: T) => ReactNode };
type OperationsTableProps<T extends { id: string }> = { caption: string; rows: readonly T[]; columns: readonly TableColumn<T>[] };

export function OperationsTable<T extends { id: string }>({ caption, rows, columns }: OperationsTableProps<T>) {
  return (
    <div className="admin-table-wrap px-5 pb-4">
      <Table className="admin-table">
        <caption className="ui-visually-hidden">{caption}</caption>
        <TableHeader><tr>{columns.map((column) => <th className="px-3 py-3 text-xs font-extrabold uppercase tracking-[0.05em] text-[var(--color-ink-soft)] first:pl-0 last:pr-0" key={column.key} scope="col">{column.label}</th>)}</tr></TableHeader>
        <TableBody>{rows.map((row) => <tr className="align-top even:bg-[var(--color-panel-muted)] hover:bg-[#f3f8f3]" key={row.id}>{columns.map((column) => <td className="px-3 py-3 text-sm first:pl-0 last:pr-0" key={column.key} data-label={column.label}>{column.render(row)}</td>)}</tr>)}</TableBody>
      </Table>
    </div>
  );
}
