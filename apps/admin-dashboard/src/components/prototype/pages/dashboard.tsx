"use client";

import { useRouter } from "next/navigation";
import {
  Download,
  LayoutTemplate,
  Plus,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  KPIS,
  PERIOD_OPTIONS,
  SALES_SERIES,
  formatRupiah,
  sumSeries,
  type AttentionItem,
  type ChartPeriod,
  type Kpi,
  type OrderStatus,
  type QuickActionKey,
} from "../data";
import { OrdersPanel } from "../orders";
import {
  AttentionPanel,
  CategoryPanel,
  KpiCard,
  KpiSkeleton,
  OrderStatusSummary,
  PopularTemplates,
  QuickActions,
  RecentActivity,
  SalesPanel,
} from "../panels";
import { usePrototype } from "../store";
import { ProtoButton } from "../ui";

const KPI_ICONS: Record<Kpi["key"], LucideIcon> = {
  orders: ShoppingCart,
  revenue: Wallet,
  users: Users,
  templates: LayoutTemplate,
};

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export function DashboardPage() {
  const router = useRouter();
  const {
    orders,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    chartMetric,
    setChartMetric,
    chartPeriod,
    setChartPeriod,
    isLoading,
    notify,
    openOrder,
  } = usePrototype();

  const periodLongLabel =
    PERIOD_OPTIONS.find((option) => option.value === chartPeriod)?.longLabel ??
    "periode terpilih";

  const periodTotal =
    chartMetric === "income"
      ? formatRupiah(sumSeries(SALES_SERIES[chartPeriod], "income"))
      : `${sumSeries(SALES_SERIES[chartPeriod], "orders")} pesanan`;

  /* Panel handlers --------------------------------------------------------- */

  const handleAttention = (item: AttentionItem) => {
    switch (item.key) {
      case "payments":
        router.push("/prototype/pembayaran");
        return;
      case "newOrders":
        router.push("/prototype/pesanan");
        return;
      case "eventData":
        router.push("/prototype/data-acara");
        return;
      case "messages":
        router.push("/prototype/pesan-masuk");
        return;
      default:
        router.push("/prototype/undangan-aktif");
    }
  };

  const handleQuickAction = (key: QuickActionKey, label: string) => {
    switch (key) {
      case "template":
        router.push("/prototype/template");
        return;
      case "order":
        router.push("/prototype/pesanan");
        return;
      case "verify":
        router.push("/prototype/pembayaran");
        return;
      case "broadcast":
        router.push("/prototype/promo");
        return;
      case "report":
        router.push("/prototype/laporan");
        return;
      case "message":
        router.push("/prototype/pesan-masuk");
        return;
      default:
        notify(`${label} dijalankan`);
    }
  };

  const handleStatusSelect = (status: OrderStatus) => {
    setStatusFilter(status);
    router.push("/prototype/pesanan");
  };

  const handleTemplateOpen = (name: string) => {
    if (name.length === 0) {
      router.push("/prototype/template");
      return;
    }
    notify(`Membuka template ${name}`);
  };

  /* Render ----------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-12">
      {/* Hero --------------------------------------------------------------- */}
      <section
        aria-labelledby="proto-welcome"
        className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#7C3340_0%,#A04556_46%,#C4677A_100%)] p-5 text-white md:col-span-2 md:p-7 lg:col-span-12"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#F6D9C8]/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F6D9C8]">
              Ringkasan Operasional
            </p>
            <h1
              id="proto-welcome"
              className="proto-display mt-2 text-[26px] font-semibold leading-tight md:text-3xl"
            >
              Selamat datang, Admin! 👋
            </h1>
            <p className="mt-2 text-sm text-white/75">
              Pantau pesanan, pembayaran, dan performa template Undangania dalam
              satu dasbor.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="proto-hero-period"
                className="text-[11px] font-semibold text-white/75"
              >
                Periode
              </label>
              <select
                id="proto-hero-period"
                value={chartPeriod}
                onChange={(event) =>
                  setChartPeriod(event.target.value as ChartPeriod)
                }
                className="h-10 rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus:border-white/60 [&>option]:text-[var(--p-ink)]"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <ProtoButton
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => router.push("/prototype/laporan")}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export Laporan
            </ProtoButton>
            <ProtoButton
              className="border-transparent text-[var(--p-rose-strong)]"
              onClick={() => router.push("/prototype/template")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah Template
            </ProtoButton>
          </div>
        </div>
      </section>

      {/* KPI ---------------------------------------------------------------- */}
      <section
        aria-label="Indikator kinerja utama"
        className="proto-scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:col-span-2 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 lg:col-span-12 lg:grid-cols-4"
      >
        {isLoading
          ? Array.from({ length: KPIS.length }, (_, index) => (
              <KpiSkeleton key={index} />
            ))
          : KPIS.map((kpi) => {
              const Icon = KPI_ICONS[kpi.key];
              return (
                <KpiCard
                  key={kpi.key}
                  label={kpi.label}
                  value={kpi.value}
                  delta={kpi.delta}
                  caption={kpi.caption}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                />
              );
            })}
      </section>

      {/* Perlu Perhatian ---------------------------------------------------- */}
      <div className="md:order-4 md:col-span-1 lg:order-4 lg:col-span-4">
        <AttentionPanel onAction={handleAttention} />
      </div>

      {/* Aksi Cepat --------------------------------------------------------- */}
      <div className="md:order-5 md:col-span-1 lg:order-9 lg:col-span-4">
        <QuickActions onAction={handleQuickAction} />
      </div>

      {/* Grafik Penjualan --------------------------------------------------- */}
      <div className="md:order-3 md:col-span-2 lg:order-3 lg:col-span-8">
        <SalesPanel
          metric={chartMetric}
          period={chartPeriod}
          onMetricChange={setChartMetric}
          onPeriodChange={setChartPeriod}
          periodLongLabel={periodLongLabel}
          periodTotal={periodTotal}
          isLoading={isLoading}
        />
      </div>

      {/* Pesanan Terbaru ---------------------------------------------------- */}
      <div className="md:order-6 md:col-span-2 lg:order-5 lg:col-span-12">
        <OrdersPanel
          orders={orders}
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onOpenOrder={openOrder}
          isLoading={isLoading}
        />
      </div>

      {/* Kategori ----------------------------------------------------------- */}
      <div className="md:order-7 md:col-span-1 lg:order-6 lg:col-span-4">
        <CategoryPanel isLoading={isLoading} />
      </div>

      {/* Ringkasan status --------------------------------------------------- */}
      <div className="md:order-8 md:col-span-1 lg:order-7 lg:col-span-4">
        <OrderStatusSummary
          activeStatus={statusFilter}
          onSelect={handleStatusSelect}
        />
      </div>

      {/* Aktivitas terbaru -------------------------------------------------- */}
      <div className="md:order-9 md:col-span-1 lg:order-8 lg:col-span-4">
        <RecentActivity onNotify={notify} />
      </div>

      {/* Template terpopuler ------------------------------------------------ */}
      <div className="md:order-10 md:col-span-1 lg:order-10 lg:col-span-8">
        <PopularTemplates onOpen={handleTemplateOpen} />
      </div>
    </div>
  );
}
