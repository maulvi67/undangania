"use client";

import { useMemo, useState } from "react";
import {
  CircleDollarSign,
  CreditCard,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import {
  PAYMENT_STATUSES,
  buildPaymentRows,
  formatDate,
  formatRupiah,
  type PaymentRow,
  type PaymentStatus,
} from "../data";
import { DataTable, type TableColumn } from "../table";
import { usePrototype } from "../store";
import {
  EmptyState,
  FilterSelect,
  PageHeader,
  PayBadge,
  ProtoButton,
  StatGrid,
  StatTile,
} from "../ui";

type PaymentFilter = PaymentStatus | "Semua";

const FILTER_OPTIONS: readonly { value: PaymentFilter; label: string }[] = [
  { value: "Semua", label: "Semua status" },
  ...PAYMENT_STATUSES.map((status) => ({ value: status, label: status })),
];

/* -------------------------------------------------------------------------- */
/* Pembayaran                                                                  */
/* -------------------------------------------------------------------------- */

export function PembayaranPage() {
  const { orders, notify, verifyPayment, openOrder } = usePrototype();
  const [filter, setFilter] = useState<PaymentFilter>("Semua");

  const rows = useMemo(() => buildPaymentRows(orders), [orders]);

  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );

  const filtered = useMemo(
    () =>
      filter === "Semua" ? rows : rows.filter((row) => row.status === filter),
    [rows, filter],
  );

  const summary = useMemo(() => {
    let menunggu = 0;
    let lunas = 0;
    let gagal = 0;
    let totalLunas = 0;
    for (const row of rows) {
      if (row.status === "Menunggu Konfirmasi") menunggu += 1;
      if (row.status === "Lunas") {
        lunas += 1;
        totalLunas += row.amount;
      }
      if (row.status === "Gagal") gagal += 1;
    }
    return { menunggu, lunas, gagal, totalLunas };
  }, [rows]);

  const columns: TableColumn<PaymentRow>[] = [
    {
      key: "invoice",
      header: "Invoice",
      mobile: true,
      cell: (row) => (
        <span className="proto-nums font-semibold text-[var(--p-ink)]">
          {row.invoice}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Pelanggan",
      mobile: true,
      cell: (row) => (
        <span className="block">
          <span className="block font-semibold text-[var(--p-ink)]">
            {row.customer}
          </span>
          <span className="proto-nums block text-[11px] text-[var(--p-ink-soft)]">
            {row.orderId}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Nominal",
      align: "right",
      mobile: true,
      cell: (row) => (
        <span className="proto-nums font-semibold text-[var(--p-ink)]">
          {formatRupiah(row.amount)}
        </span>
      ),
    },
    {
      key: "method",
      header: "Metode",
      cell: (row) => (
        <span className="text-[var(--p-ink-soft)]">{row.method}</span>
      ),
    },
    {
      key: "date",
      header: "Tanggal",
      mobile: true,
      cell: (row) => (
        <span className="proto-nums text-[var(--p-ink-soft)]">
          {formatDate(row.submittedAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: true,
      cell: (row) => <PayBadge status={row.status} />,
    },
    {
      key: "action",
      header: "Aksi",
      mobile: true,
      align: "right",
      cell: (row) => {
        const order = orderById.get(row.orderId);
        if (row.status !== "Menunggu Konfirmasi" || order === undefined) {
          return (
            <span className="text-[11px] text-[var(--p-ink-soft)]">-</span>
          );
        }
        return (
          <ProtoButton
            size="sm"
            variant="primary"
            onClick={(event) => {
              event.stopPropagation();
              verifyPayment(order);
            }}
          >
            Verifikasi
          </ProtoButton>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Pembayaran"
        description="Verifikasi bukti transfer dan pantau status pembayaran setiap pesanan undangan."
        actions={
          <ProtoButton
            onClick={() => notify("Rekonsiliasi pembayaran dimulai")}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Rekonsiliasi
          </ProtoButton>
        }
      />

      <StatGrid>
        <StatTile
          label="Menunggu Konfirmasi"
          value={String(summary.menunggu)}
          hint="Perlu diverifikasi"
          tone="amber"
          icon={<TriangleAlert className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Lunas"
          value={String(summary.lunas)}
          hint="Pembayaran diterima"
          tone="emerald"
          icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Gagal"
          value={String(summary.gagal)}
          hint="Perlu ditindaklanjuti"
          tone="rose"
          icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Nilai Lunas"
          value={formatRupiah(summary.totalLunas)}
          hint="Dari pesanan pada daftar"
          tone="sky"
          icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--p-line)] bg-white p-4 shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] sm:flex-row sm:items-end sm:justify-between md:p-5">
        <FilterSelect
          label="Filter status pembayaran"
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          className="w-full sm:w-56"
        />
        <p className="text-[11px] text-[var(--p-ink-soft)]">
          Menampilkan {filtered.length} dari {rows.length} pembayaran
        </p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
        <DataTable
          rows={filtered}
          columns={columns}
          caption="Daftar pembayaran"
          minWidth="min-w-[900px]"
          onRowClick={(row) => {
            const order = orderById.get(row.orderId);
            if (order !== undefined) openOrder(order);
          }}
          empty={
            <EmptyState
              icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
              title="Tidak ada pembayaran"
              description="Belum ada pembayaran dengan status ini."
              action={
                <ProtoButton size="sm" onClick={() => setFilter("Semua")}>
                  Tampilkan semua
                </ProtoButton>
              }
            />
          }
        />
      </div>
    </div>
  );
}
