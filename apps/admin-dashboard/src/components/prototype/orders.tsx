"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Funnel,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "../ui/cn";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  formatDate,
  formatRupiah,
  getTemplateGradient,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from "./data";
import {
  EmptyState,
  IconButton,
  OrderBadge,
  PayBadge,
  ProtoButton,
  ProtoCard,
  ProtoDialog,
  SectionHeading,
  Skeleton,
} from "./ui";

const PAGE_SIZE = 5;

export type SortKey = "date-desc" | "date-asc" | "total-desc" | "total-asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Terbaru" },
  { value: "date-asc", label: "Terlama" },
  { value: "total-desc", label: "Total tertinggi" },
  { value: "total-asc", label: "Total terendah" },
];

type StatusFilter = OrderStatus | "Semua";
type PaymentFilter = PaymentStatus | "Semua";

const FILTER_SELECT_CLASS =
  "h-10 w-full rounded-xl border border-[var(--p-line)] bg-white px-3 text-[13px] text-[var(--p-ink)] outline-none focus:border-[var(--p-rose)]";

export function OrdersPanel({
  orders,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  onOpenOrder,
  isLoading,
}: {
  orders: Order[];
  query: string;
  onQueryChange: (next: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (next: StatusFilter) => void;
  onOpenOrder: (order: Order) => void;
  isLoading: boolean;
}) {
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("Semua");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("Semua");
  const [draftPayment, setDraftPayment] = useState<PaymentFilter>("Semua");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = orders.filter((order) => {
      const matchesQuery =
        needle.length === 0 ||
        [order.id, order.customer, order.event, order.template].some((field) =>
          field.toLowerCase().includes(needle),
        );
      const matchesStatus =
        statusFilter === "Semua" || order.status === statusFilter;
      const matchesPayment =
        paymentFilter === "Semua" || order.payment === paymentFilter;
      return matchesQuery && matchesStatus && matchesPayment;
    });

    return [...rows].sort((a, b) => {
      if (sort === "date-asc") return a.date.localeCompare(b.date);
      if (sort === "total-desc") return b.total - a.total;
      if (sort === "total-asc") return a.total - b.total;
      return b.date.localeCompare(a.date);
    });
  }, [orders, query, statusFilter, paymentFilter, sort]);

  // Clamp instead of resetting via an effect, so filtering never flashes an
  // out-of-range page.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const activeFilterCount =
    (statusFilter === "Semua" ? 0 : 1) + (paymentFilter === "Semua" ? 0 : 1);

  function openFilterSheet() {
    setDraftStatus(statusFilter);
    setDraftPayment(paymentFilter);
    setSheetOpen(true);
  }

  function applyFilters() {
    onStatusFilterChange(draftStatus);
    setPaymentFilter(draftPayment);
    setPage(1);
    setSheetOpen(false);
  }

  function resetFilters() {
    setDraftStatus("Semua");
    setDraftPayment("Semua");
    onStatusFilterChange("Semua");
    setPaymentFilter("Semua");
    setPage(1);
  }

  function toggleSort(next: SortKey) {
    setSort(next);
    setPage(1);
  }

  return (
    <ProtoCard className="overflow-hidden">
      <div className="border-b border-[var(--p-line)] p-5">
        <SectionHeading
          title="Pesanan Terbaru"
          description="Kelola pesanan masuk dan status pengerjaannya"
          action={
            <ProtoButton
              size="sm"
              variant="ghost"
              onClick={() => onQueryChange("")}
              className={cn(query.length === 0 && "invisible")}
            >
              Bersihkan pencarian
            </ProtoButton>
          }
        />

        {/* Toolbar: inline on md+, collapsed into a bottom sheet below md. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-[220px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--p-ink-soft)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
                setPage(1);
              }}
              placeholder="Cari nomor pesanan, pelanggan, atau template..."
              aria-label="Cari pesanan"
              className="h-10 w-full rounded-xl border border-[var(--p-line)] bg-white pl-9 pr-3 text-[13px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-ink-soft)] focus:border-[var(--p-rose)]"
            />
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <select
              value={statusFilter}
              onChange={(event) => {
                onStatusFilterChange(event.target.value as StatusFilter);
                setPage(1);
              }}
              aria-label="Filter status pesanan"
              className={cn(FILTER_SELECT_CLASS, "w-auto")}
            >
              <option value="Semua">Semua status</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={paymentFilter}
              onChange={(event) => {
                setPaymentFilter(event.target.value as PaymentFilter);
                setPage(1);
              }}
              aria-label="Filter status pembayaran"
              className={cn(FILTER_SELECT_CLASS, "w-auto")}
            >
              <option value="Semua">Semua pembayaran</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(event) => toggleSort(event.target.value as SortKey)}
              aria-label="Urutkan pesanan"
              className={cn(FILTER_SELECT_CLASS, "w-auto")}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <ProtoButton
            size="md"
            className="md:hidden"
            onClick={openFilterSheet}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filter
            {activeFilterCount > 0 ? (
              <span className="proto-nums grid h-5 min-w-5 place-items-center rounded-full bg-[var(--p-rose)] px-1 text-[10px] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </ProtoButton>
        </div>

        {activeFilterCount > 0 || query.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--p-ink-soft)]">
            <span className="proto-nums">
              {filtered.length} pesanan cocok dengan filter aktif
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-[var(--p-rose-strong)] underline underline-offset-2"
            >
              Atur ulang
            </button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
          title="Pesanan tidak ditemukan"
          description="Tidak ada pesanan yang cocok dengan pencarian atau filter yang dipilih. Coba kata kunci lain."
          action={
            <ProtoButton size="sm" onClick={resetFilters}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Atur ulang filter
            </ProtoButton>
          }
        />
      ) : null}

      {!isLoading && filtered.length > 0 ? (
        <>
          {/* Desktop + tablet: table. Scrolls horizontally on narrow tablets. */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
                <caption className="sr-only">
                  Daftar pesanan terbaru beserta status pembayaran dan
                  pengerjaannya
                </caption>
                <thead>
                  <tr className="bg-[var(--p-canvas)] text-[11px] uppercase tracking-wider text-[var(--p-ink-soft)]">
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Pesanan
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Pelanggan
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Template
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      <SortButton
                        label="Tanggal"
                        active={sort === "date-desc" || sort === "date-asc"}
                        direction={sort === "date-asc" ? "asc" : "desc"}
                        onClick={() =>
                          toggleSort(
                            sort === "date-desc" ? "date-asc" : "date-desc",
                          )
                        }
                      />
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      <SortButton
                        label="Total"
                        align="right"
                        active={sort === "total-desc" || sort === "total-asc"}
                        direction={sort === "total-asc" ? "asc" : "desc"}
                        onClick={() =>
                          toggleSort(
                            sort === "total-desc" ? "total-asc" : "total-desc",
                          )
                        }
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Pembayaran
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr
                      key={order.id}
                      className="border-t border-[var(--p-line)] transition hover:bg-[var(--p-rose-soft)]"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--p-ink)]">
                        {order.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--p-ink)]">
                            {order.customer}
                          </p>
                          <p className="truncate text-[11px] text-[var(--p-ink-soft)]">
                            {order.event}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-6 w-6 shrink-0 rounded-lg"
                            style={{
                              background: getTemplateGradient(order.template),
                            }}
                          />
                          <span className="truncate text-[var(--p-ink)]">
                            {order.template}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--p-ink-soft)]">
                        {formatDate(order.date)}
                      </td>
                      <td className="proto-nums whitespace-nowrap px-4 py-3 text-right font-semibold text-[var(--p-ink)]">
                        {formatRupiah(order.total)}
                      </td>
                      <td className="px-4 py-3">
                        <PayBadge status={order.payment} />
                      </td>
                      <td className="px-4 py-3">
                        <OrderBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.payment === "Menunggu Konfirmasi" ? (
                            <ProtoButton
                              size="sm"
                              variant="primary"
                              onClick={() => onOpenOrder(order)}
                            >
                              Verifikasi
                            </ProtoButton>
                          ) : null}
                          <IconButton
                            label={`Buka detail pesanan ${order.id}`}
                            className="h-9 w-9"
                            onClick={() => onOpenOrder(order)}
                          >
                            <Ellipsis className="h-4 w-4" aria-hidden="true" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: stacked cards. */}
          <ul className="space-y-3 p-3 md:hidden">
            {visible.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onOpenOrder(order)}
                  className="w-full rounded-2xl border border-[var(--p-line)] p-4 text-left transition hover:bg-[var(--p-rose-soft)] active:translate-y-px"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="proto-nums text-[13px] font-semibold text-[var(--p-ink)]">
                        {order.id}
                      </p>
                      <p className="truncate text-[13px] font-semibold text-[var(--p-ink)]">
                        {order.customer}
                      </p>
                      <p className="truncate text-[11px] text-[var(--p-ink-soft)]">
                        {order.event}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="h-10 w-10 shrink-0 rounded-xl"
                      style={{
                        background: getTemplateGradient(order.template),
                      }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--p-ink-soft)]">
                    <span className="truncate">{order.template}</span>
                    <span className="shrink-0">{formatDate(order.date)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <PayBadge status={order.payment} />
                    <OrderBadge status={order.status} />
                    <span className="proto-nums ml-auto font-semibold text-[var(--p-ink)]">
                      {formatRupiah(order.total)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--p-line)] px-5 py-4">
            <p className="proto-nums text-[11px] text-[var(--p-ink-soft)]">
              Menampilkan {startIndex + 1}–
              {Math.min(startIndex + PAGE_SIZE, filtered.length)} dari{" "}
              {filtered.length} pesanan
            </p>

            <div className="flex items-center gap-1.5">
              <IconButton
                label="Halaman sebelumnya"
                className="h-9 w-9"
                disabled={currentPage === 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </IconButton>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    aria-current={
                      pageNumber === currentPage ? "page" : undefined
                    }
                    onClick={() => setPage(pageNumber)}
                    className={cn(
                      "proto-nums h-9 min-w-9 rounded-xl px-2 text-[13px] font-semibold transition",
                      pageNumber === currentPage
                        ? "bg-[var(--p-rose)] text-white"
                        : "border border-[var(--p-line)] bg-white text-[var(--p-ink-soft)] hover:bg-[var(--p-rose-soft)]",
                    )}
                  >
                    {pageNumber}
                  </button>
                ),
              )}

              <IconButton
                label="Halaman berikutnya"
                className="h-9 w-9"
                disabled={currentPage === totalPages}
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        </>
      ) : null}

      {/* Mobile filter bottom sheet. */}
      <ProtoDialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter Pesanan"
        description="Pilih status lalu tekan Terapkan"
        footer={
          <div className="flex gap-2">
            <ProtoButton className="flex-1" onClick={resetFilters}>
              Atur ulang
            </ProtoButton>
            <ProtoButton
              className="flex-1"
              variant="primary"
              onClick={applyFilters}
            >
              Terapkan
            </ProtoButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="proto-filter-status"
              className="block text-xs font-semibold text-[var(--p-ink)]"
            >
              Status pesanan
            </label>
            <select
              id="proto-filter-status"
              value={draftStatus}
              onChange={(event) =>
                setDraftStatus(event.target.value as StatusFilter)
              }
              className={FILTER_SELECT_CLASS}
            >
              <option value="Semua">Semua status</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="proto-filter-payment"
              className="block text-xs font-semibold text-[var(--p-ink)]"
            >
              Status pembayaran
            </label>
            <select
              id="proto-filter-payment"
              value={draftPayment}
              onChange={(event) =>
                setDraftPayment(event.target.value as PaymentFilter)
              }
              className={FILTER_SELECT_CLASS}
            >
              <option value="Semua">Semua pembayaran</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="proto-filter-sort"
              className="block text-xs font-semibold text-[var(--p-ink)]"
            >
              Urutkan
            </label>
            <select
              id="proto-filter-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className={FILTER_SELECT_CLASS}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-[var(--p-line)] bg-[var(--p-canvas)] p-3 text-[11px] leading-relaxed text-[var(--p-ink-soft)]">
            <Funnel
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            Filter hanya berlaku di prototype ini dan tidak mengubah data
            pesanan.
          </p>
        </div>
      </ProtoDialog>
    </ProtoCard>
  );
}

function SortButton({
  label,
  active,
  direction,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 font-semibold uppercase tracking-wider transition",
        align === "right" && "flex-row-reverse",
        active ? "text-[var(--p-rose-strong)]" : "text-[var(--p-ink-soft)]",
      )}
    >
      {label}
      <ArrowUpDown
        className={cn("h-3 w-3", !active && "opacity-50")}
        aria-hidden="true"
      />
      <span className="sr-only">
        {active
          ? direction === "asc"
            ? "terurut menaik"
            : "terurut menurun"
          : "belum terurut"}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Order detail dialog                                                         */
/* -------------------------------------------------------------------------- */

export function OrderDetailDialog({
  order,
  onClose,
  onPreview,
  onContact,
  onVerifyPayment,
  onChangeStatus,
  onRequestCancel,
}: {
  order: Order | null;
  onClose: () => void;
  onPreview: (order: Order) => void;
  onContact: (order: Order) => void;
  onVerifyPayment: (order: Order) => void;
  onChangeStatus: (order: Order, status: OrderStatus) => void;
  onRequestCancel: (order: Order) => void;
}) {
  return (
    <ProtoDialog
      open={order !== null}
      onClose={onClose}
      title={order ? `Detail Pesanan ${order.id}` : "Detail Pesanan"}
      description={order ? `${order.event} · ${order.template}` : undefined}
      footer={
        order ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <ProtoButton className="flex-1" onClick={() => onPreview(order)}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Preview undangan
            </ProtoButton>
            <ProtoButton
              className="flex-1"
              variant="primary"
              disabled={order.payment !== "Menunggu Konfirmasi"}
              onClick={() => onVerifyPayment(order)}
            >
              Verifikasi pembayaran
            </ProtoButton>
          </div>
        ) : null
      }
    >
      {order ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--p-line)] bg-[var(--p-canvas)] p-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="h-14 w-14 shrink-0 rounded-2xl"
                style={{ background: getTemplateGradient(order.template) }}
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--p-ink)]">
                  {order.customer}
                </p>
                <p className="truncate text-xs text-[var(--p-ink-soft)]">
                  {order.event}
                </p>
                <p className="mt-1 text-xs text-[var(--p-ink-soft)]">
                  {order.phone}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PayBadge status={order.payment} />
              <OrderBadge status={order.status} />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <DetailRow label="Nomor pesanan" value={order.id} />
            <DetailRow label="Template" value={order.template} />
            <DetailRow label="Tanggal pesan" value={formatDate(order.date)} />
            <DetailRow
              label="Tanggal acara"
              value={formatDate(order.eventDate)}
            />
            <DetailRow
              label="Total"
              value={formatRupiah(order.total)}
              emphasize
            />
            <DetailRow label="Metode" value="Transfer bank" />
          </dl>

          <div className="space-y-2">
            <label
              htmlFor="proto-order-status"
              className="block text-xs font-semibold text-[var(--p-ink)]"
            >
              Ubah status pesanan
            </label>
            <select
              id="proto-order-status"
              value={order.status}
              onChange={(event) =>
                onChangeStatus(order, event.target.value as OrderStatus)
              }
              className={FILTER_SELECT_CLASS}
            >
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <ProtoButton
              size="sm"
              className="flex-1"
              onClick={() => onContact(order)}
            >
              Hubungi pelanggan
            </ProtoButton>
            <ProtoButton
              size="sm"
              variant="danger"
              className="flex-1"
              disabled={order.status === "Dibatalkan"}
              onClick={() => onRequestCancel(order)}
            >
              Batalkan pesanan
            </ProtoButton>
          </div>
        </div>
      ) : null}
    </ProtoDialog>
  );
}

function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[var(--p-ink-soft)]">{label}</dt>
      <dd
        className={cn(
          "proto-nums mt-0.5 truncate",
          emphasize
            ? "proto-display text-base font-semibold text-[var(--p-ink)]"
            : "font-semibold text-[var(--p-ink)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
