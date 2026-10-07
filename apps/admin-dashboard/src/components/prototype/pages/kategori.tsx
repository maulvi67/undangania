"use client";

import { useMemo } from "react";
import { Palette, PieChart, ShoppingCart, TrendingUp } from "lucide-react";
import { CATEGORIES, TOTAL_CATEGORY_COUNT, type CategorySlice } from "../data";
import { CategoryDonut } from "../charts";
import { DataTable, ProgressBar, type TableColumn } from "../table";
import { usePrototype } from "../store";
import {
  PageHeader,
  ProtoCard,
  SectionHeading,
  StatGrid,
  StatTile,
} from "../ui";

type CategoryRow = CategorySlice & { id: string };

/* -------------------------------------------------------------------------- */
/* Kategori                                                                    */
/* -------------------------------------------------------------------------- */

export function KategoriPage() {
  const { notify } = usePrototype();

  const rows = useMemo<CategoryRow[]>(
    () => CATEGORIES.map((slice) => ({ ...slice, id: slice.name })),
    [],
  );

  const topSlice = CATEGORIES[0];
  const maxCount = rows.reduce(
    (highest, row) => (row.count > highest ? row.count : highest),
    0,
  );
  const average = Math.round(TOTAL_CATEGORY_COUNT / Math.max(rows.length, 1));

  const columns: TableColumn<CategoryRow>[] = [
    {
      key: "name",
      header: "Kategori",
      mobile: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: row.color }}
          />
          <span className="font-semibold text-[var(--p-ink)]">{row.name}</span>
        </span>
      ),
    },
    {
      key: "count",
      header: "Pesanan",
      align: "right",
      mobile: true,
      cell: (row) => (
        <span className="proto-nums text-[var(--p-ink)]">{row.count}</span>
      ),
    },
    {
      key: "percent",
      header: "Pangsa",
      align: "right",
      mobile: true,
      cell: (row) => (
        <span className="proto-nums font-semibold text-[var(--p-ink)]">
          {row.percent}%
        </span>
      ),
    },
    {
      key: "share",
      header: "Sebaran",
      cell: (row) => (
        <span className="block w-full min-w-[140px]">
          <ProgressBar value={row.count} max={maxCount} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Kategori"
        description="Sebaran pesanan berdasarkan gaya desain undangan yang dijual."
      />

      <StatGrid>
        <StatTile
          label="Total Kategori"
          value={String(rows.length)}
          hint="Gaya desain aktif"
          icon={<Palette className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Total Pesanan"
          value={String(TOTAL_CATEGORY_COUNT)}
          hint="Dari seluruh kategori"
          tone="sky"
          icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Kategori Teratas"
          value={topSlice ? topSlice.name : "-"}
          hint={topSlice ? `${topSlice.percent}% dari pesanan` : undefined}
          tone="emerald"
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Rata-rata"
          value={`${average} pesanan`}
          hint="Per kategori"
          tone="amber"
          icon={<PieChart className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-12">
        <ProtoCard className="p-5 lg:col-span-5">
          <SectionHeading
            title="Komposisi Kategori"
            description="Pangsa pesanan per gaya desain"
          />
          <div className="mt-4">
            <CategoryDonut />
          </div>
        </ProtoCard>

        <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] lg:col-span-7">
          <DataTable
            rows={rows}
            columns={columns}
            caption="Rincian kategori"
            minWidth="min-w-[560px]"
            onRowClick={(row) => notify(`Kategori ${row.name} dibuka`)}
          />
        </div>
      </div>
    </div>
  );
}
