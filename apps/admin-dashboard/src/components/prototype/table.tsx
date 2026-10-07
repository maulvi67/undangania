"use client";

import type { ReactNode } from "react";
import { cn } from "../ui/cn";

/* -------------------------------------------------------------------------- */
/* Generic data table                                                          */
/*                                                                            */
/* Desktop renders a real table (horizontally scrollable when it does not fit) */
/* and mobile renders one stacked card per row, so the wide tables never       */
/* introduce horizontal page overflow.                                        */
/* -------------------------------------------------------------------------- */

export type TableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Include this column in the mobile stacked card. */
  mobile?: boolean;
  align?: "left" | "right";
  /** Extra classes for the desktop cell (e.g. width hints). */
  className?: string;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  caption,
  empty,
  minWidth = "min-w-[820px]",
}: {
  rows: T[];
  columns: TableColumn<T>[];
  onRowClick?: ((row: T) => void) | undefined;
  caption?: string | undefined;
  empty?: ReactNode | undefined;
  minWidth?: string | undefined;
}) {
  if (rows.length === 0) {
    return <>{empty ?? null}</>;
  }

  const mobileColumns = columns.filter((column) => column.mobile === true);
  const handleRowClick = onRowClick;
  const interactive = handleRowClick !== undefined;

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table
            className={cn(
              "w-full border-collapse text-left text-[13px]",
              minWidth,
            )}
          >
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead>
              <tr className="border-b border-[var(--p-line)]">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--p-ink-soft)]",
                      column.align === "right" && "text-right",
                      column.className,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={
                    handleRowClick ? () => handleRowClick(row) : undefined
                  }
                  className={cn(
                    "border-b border-[var(--p-line)]/60 align-middle last:border-0",
                    interactive &&
                      "cursor-pointer transition hover:bg-[var(--p-rose-soft)]/45",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-4 py-3.5",
                        column.align === "right" && "text-right",
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 p-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <div
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={handleRowClick ? () => handleRowClick(row) : undefined}
              onKeyDown={
                handleRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                "rounded-2xl border border-[var(--p-line)] bg-white p-4",
                interactive && "cursor-pointer active:translate-y-px",
              )}
            >
              <dl className="space-y-2.5">
                {mobileColumns.map((column) => (
                  <div
                    key={column.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--p-ink-soft)]">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 text-right text-[13px] text-[var(--p-ink)]">
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Small horizontal progress bar used for quota / share columns. */
export function ProgressBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string | undefined;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span
      className={cn(
        "block h-1.5 w-full overflow-hidden rounded-full bg-[var(--p-rose-soft)]",
        className,
      )}
      role="img"
      aria-label={`${percent}%`}
    >
      <span
        className="block h-full rounded-full bg-[var(--p-rose)]"
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}
