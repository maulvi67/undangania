import type { ReactNode } from "react";

type TableColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

type OperationsTableProps<T extends { id: string }> = {
  caption: string;
  rows: readonly T[];
  columns: readonly TableColumn<T>[];
};

export function OperationsTable<T extends { id: string }>({
  caption,
  rows,
  columns,
}: OperationsTableProps<T>) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="ui-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
