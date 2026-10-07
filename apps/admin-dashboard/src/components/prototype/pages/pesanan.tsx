"use client";

import {
  CircleCheck,
  Download,
  LoaderCircle,
  Package,
  Plus,
  ShoppingCart,
} from "lucide-react";
import {
  ORDER_STATUS_COUNTS,
  TOTAL_ORDER_COUNT,
  type OrderStatus,
} from "../data";
import { OrdersPanel } from "../orders";
import { usePrototype } from "../store";
import { PageHeader, ProtoButton, StatGrid, StatTile } from "../ui";

function statusCount(status: OrderStatus): number {
  return ORDER_STATUS_COUNTS.find((row) => row.status === status)?.count ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Pesanan                                                                     */
/* -------------------------------------------------------------------------- */

export function PesananPage() {
  const {
    orders,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    isLoading,
    notify,
    openOrder,
  } = usePrototype();

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Pesanan"
        description="Kelola pesanan undangan digital: verifikasi pembayaran, ubah status, dan pantau tenggat data acara."
        actions={
          <>
            <ProtoButton onClick={() => notify("Laporan pesanan disiapkan")}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </ProtoButton>
            <ProtoButton
              variant="primary"
              onClick={() => notify("Form pesanan manual dibuka")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Pesanan Baru
            </ProtoButton>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Total Pesanan"
          value={String(TOTAL_ORDER_COUNT)}
          hint="Seluruh status"
          icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Baru"
          value={String(statusCount("Baru"))}
          hint="Belum ditindaklanjuti"
          tone="amber"
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Diproses"
          value={String(statusCount("Diproses"))}
          hint="Sedang dikerjakan"
          tone="sky"
          icon={<LoaderCircle className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Selesai"
          value={String(statusCount("Selesai"))}
          hint="Undangan terkirim"
          tone="emerald"
          icon={<CircleCheck className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

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
  );
}
