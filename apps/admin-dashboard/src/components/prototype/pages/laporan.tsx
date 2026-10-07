"use client";

import { useMemo } from "react";
import {
  ChartColumnBig,
  CircleDollarSign,
  Download,
  Printer,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import {
  PERIOD_OPTIONS,
  SALES_SERIES,
  formatRupiah,
  sumSeries,
  type SalesPoint,
} from "../data";
import { SalesPanel } from "../panels";
import { DataTable, type TableColumn } from "../table";
import { usePrototype } from "../store";
import { PageHeader, ProtoButton, StatGrid, StatTile } from "../ui";

type SeriesRow = SalesPoint & { id: string };

/* -------------------------------------------------------------------------- */
/* Laporan                                                                     */
/* -------------------------------------------------------------------------- */

export function LaporanPage() {
  const {
    chartMetric,
    setChartMetric,
    chartPeriod,
    setChartPeriod,
    isLoading,
    notify,
  } = usePrototype();

  const series = SALES_SERIES[chartPeriod];

  const periodLongLabel =
    PERIOD_OPTIONS.find((option) => option.value === chartPeriod)?.longLabel ??
    "periode terpilih";

  const stats = useMemo(() => {
    const income = sumSeries(series, "income");
    const orders = sumSeries(series, "orders");
    let best: SalesPoint | undefined;
    for (const point of series) {
      if (best === undefined || point.income > best.income) best = point;
    }
    return {
      income,
      orders,
      average: orders === 0 ? 0 : Math.round(income / orders),
      best,
    };
  }, [series]);

  const rows = useMemo<SeriesRow[]>(
    () => series.map((point) => ({ ...point, id: point.label })),
    [series],
  );

  const periodTotal =
    chartMetric === "income"
      ? formatRupiah(stats.income)
      : `${stats.orders} pesanan`;

  const columns: TableColumn<SeriesRow>[] = [
    {
      key: "label",
      header: "Periode",
      mobile: true,
      cell: (row) => (
        <span className="proto-nums font-semibold text-[var(--p-ink)]">
          {row.label}
        </span>
      ),
    },
    {
      key: "orders",
      header: "Pesanan",
      align: "right",
      mobile: true,
      cell: (row) => (
        <span className="proto-nums text-[var(--p-ink)]">{row.orders}</span>
      ),
    },
    {
      key: "income",
      header: "Pendapatan",
      align: "right",
      mobile: true,
      cell: (row) => (
        <span className="proto-nums font-semibold text-[var(--p-ink)]">
          {formatRupiah(row.income)}
        </span>
      ),
    },
    {
      key: "average",
      header: "Rata-rata",
      align: "right",
      cell: (row) => (
        <span className="proto-nums text-[var(--p-ink-soft)]">
          {formatRupiah(Math.round(row.income / Math.max(row.orders, 1)))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Laporan"
        description="Rekap penjualan undangan digital per periode, siap diekspor untuk pembukuan."
        actions={
          <>
            <ProtoButton onClick={() => notify("Laporan dicetak")}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Cetak
            </ProtoButton>
            <ProtoButton
              variant="primary"
              onClick={() => notify("Laporan penjualan diunduh")}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Unduh Laporan
            </ProtoButton>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Total Pendapatan"
          value={formatRupiah(stats.income)}
          hint={periodLongLabel}
          icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Total Pesanan"
          value={String(stats.orders)}
          hint={periodLongLabel}
          tone="sky"
          icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Rata-rata per Pesanan"
          value={formatRupiah(stats.average)}
          hint="Nilai transaksi"
          tone="emerald"
          icon={<ChartColumnBig className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Periode Terbaik"
          value={stats.best ? stats.best.label : "-"}
          hint={stats.best ? formatRupiah(stats.best.income) : "Belum ada data"}
          tone="amber"
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      <SalesPanel
        metric={chartMetric}
        period={chartPeriod}
        onMetricChange={setChartMetric}
        onPeriodChange={setChartPeriod}
        periodLongLabel={periodLongLabel}
        periodTotal={periodTotal}
        isLoading={isLoading}
      />

      <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
        <DataTable
          rows={rows}
          columns={columns}
          caption={`Rincian penjualan ${periodLongLabel}`}
          minWidth="min-w-[620px]"
        />
      </div>
    </div>
  );
}
