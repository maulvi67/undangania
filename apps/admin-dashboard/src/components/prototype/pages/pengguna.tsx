"use client";

import { useMemo, useState } from "react";
import {
  MessageCircle,
  Phone,
  UserPlus,
  Users,
  UsersRound,
  Ban,
} from "lucide-react";
import {
  CUSTOMERS,
  KPIS,
  formatDate,
  formatRupiah,
  type Customer,
  type CustomerStatus,
} from "../data";
import { DataTable, type TableColumn } from "../table";
import { usePrototype } from "../store";
import {
  EmptyState,
  FilterSelect,
  PageHeader,
  ProtoButton,
  SearchField,
  StatGrid,
  StatTile,
} from "../ui";

type CustomerFilter = CustomerStatus | "Semua";

const CUSTOMER_TONE: Record<CustomerStatus, string> = {
  Aktif: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Baru: "border-sky-200 bg-sky-50 text-sky-700",
  Nonaktif: "border-stone-200 bg-stone-100 text-stone-600",
};

const FILTER_OPTIONS: readonly { value: CustomerFilter; label: string }[] = [
  { value: "Semua", label: "Semua status" },
  { value: "Aktif", label: "Aktif" },
  { value: "Baru", label: "Baru" },
  { value: "Nonaktif", label: "Nonaktif" },
];

/* -------------------------------------------------------------------------- */
/* Pengguna                                                                    */
/* -------------------------------------------------------------------------- */

export function PenggunaPage() {
  const { notify } = usePrototype();
  const [filter, setFilter] = useState<CustomerFilter>("Semua");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    let aktif = 0;
    let baru = 0;
    let nonaktif = 0;
    for (const customer of CUSTOMERS) {
      if (customer.status === "Aktif") aktif += 1;
      if (customer.status === "Baru") baru += 1;
      if (customer.status === "Nonaktif") nonaktif += 1;
    }
    return { aktif, baru, nonaktif };
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return CUSTOMERS.filter((customer) => {
      const matchesStatus = filter === "Semua" || customer.status === filter;
      const matchesSearch =
        needle.length === 0 ||
        [customer.name, customer.email, customer.city, customer.phone].some(
          (field) => field.toLowerCase().includes(needle),
        );
      return matchesStatus && matchesSearch;
    });
  }, [filter, search]);

  const totalCustomers =
    KPIS.find((kpi) => kpi.key === "users")?.value ?? "1.842";

  const columns: TableColumn<Customer>[] = [
    {
      key: "name",
      header: "Pelanggan",
      mobile: true,
      cell: (customer) => (
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--p-rose-soft)] text-[11px] font-semibold text-[var(--p-rose-strong)]"
          >
            {initials(customer.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--p-ink)]">
              {customer.name}
            </span>
            <span className="block truncate text-[11px] text-[var(--p-ink-soft)]">
              {customer.email}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "city",
      header: "Kota",
      mobile: true,
      cell: (customer) => (
        <span className="text-[var(--p-ink-soft)]">{customer.city}</span>
      ),
    },
    {
      key: "joined",
      header: "Bergabung",
      cell: (customer) => (
        <span className="proto-nums text-[var(--p-ink-soft)]">
          {formatDate(customer.joinedAt)}
        </span>
      ),
    },
    {
      key: "orders",
      header: "Pesanan",
      align: "right",
      mobile: true,
      cell: (customer) => (
        <span className="proto-nums text-[var(--p-ink)]">
          {customer.orders}
        </span>
      ),
    },
    {
      key: "spent",
      header: "Total Belanja",
      align: "right",
      mobile: true,
      cell: (customer) => (
        <span className="proto-nums font-semibold text-[var(--p-ink)]">
          {formatRupiah(customer.totalSpent)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: true,
      cell: (customer) => (
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${CUSTOMER_TONE[customer.status]}`}
        >
          {customer.status}
        </span>
      ),
    },
    {
      key: "action",
      header: "Aksi",
      align: "right",
      cell: (customer) => (
        <ProtoButton
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            notify(`Pesan untuk ${customer.name} disiapkan`);
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Hubungi
        </ProtoButton>
      ),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Pengguna"
        description="Daftar pelanggan Undangania beserta riwayat pesanan dan nilai belanjanya."
        actions={
          <ProtoButton
            variant="primary"
            onClick={() => notify("Form tambah pengguna dibuka")}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Tambah Pengguna
          </ProtoButton>
        }
      />

      <StatGrid>
        <StatTile
          label="Pengguna Aktif"
          value={totalCustomers}
          hint="Naik 18% bulan ini"
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Pelanggan Baru"
          value={String(stats.baru)}
          hint="30 hari terakhir"
          tone="sky"
          icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Berlangganan"
          value={String(stats.aktif)}
          hint="Pernah memesan"
          tone="emerald"
          icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Nonaktif"
          value={String(stats.nonaktif)}
          hint="Belum ada pesanan baru"
          tone="amber"
          icon={<Ban className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--p-line)] bg-white p-4 shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] sm:flex-row sm:items-end md:p-5">
        <SearchField
          label="Cari pengguna"
          value={search}
          onChange={setSearch}
          placeholder="Cari nama, email, kota, atau telepon..."
          className="flex-1"
        />
        <FilterSelect
          label="Status"
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          className="w-full sm:w-48"
        />
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
        <DataTable
          rows={filtered}
          columns={columns}
          caption="Daftar pengguna"
          minWidth="min-w-[900px]"
          empty={
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              title="Pengguna tidak ditemukan"
              description="Coba kata kunci lain atau ubah filter status."
              action={
                <ProtoButton
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setFilter("Semua");
                  }}
                >
                  Reset filter
                </ProtoButton>
              }
            />
          }
        />
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-[var(--p-ink-soft)]">
        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
        Hubungi pelanggan melalui WhatsApp Business yang terhubung.
      </p>
    </div>
  );
}

/** "Andi Pratama" -> "AP" */
function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
