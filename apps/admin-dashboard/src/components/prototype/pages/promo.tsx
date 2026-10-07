"use client";

import { useMemo, useState } from "react";
import { Copy, Megaphone, Percent, Plus, Ticket, Zap } from "lucide-react";
import { PROMOS, type Promo, type PromoStatus } from "../data";
import { DataTable, ProgressBar, type TableColumn } from "../table";
import { usePrototype } from "../store";
import {
  EmptyState,
  FilterSelect,
  PageHeader,
  ProtoButton,
  StatGrid,
  StatTile,
} from "../ui";

type PromoFilter = PromoStatus | "Semua";

const PROMO_TONE: Record<PromoStatus, string> = {
  Aktif: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Berakhir: "border-stone-200 bg-stone-100 text-stone-600",
  Draf: "border-amber-200 bg-amber-50 text-amber-700",
};

const FILTER_OPTIONS: readonly { value: PromoFilter; label: string }[] = [
  { value: "Semua", label: "Semua status" },
  { value: "Aktif", label: "Aktif" },
  { value: "Berakhir", label: "Berakhir" },
  { value: "Draf", label: "Draf" },
];

/* -------------------------------------------------------------------------- */
/* Promo                                                                       */
/* -------------------------------------------------------------------------- */

export function PromoPage() {
  const { notify } = usePrototype();
  const [filter, setFilter] = useState<PromoFilter>("Semua");

  const stats = useMemo(() => {
    let aktif = 0;
    let used = 0;
    let quota = 0;
    let berakhir = 0;
    for (const promo of PROMOS) {
      if (promo.status === "Aktif") aktif += 1;
      if (promo.status === "Berakhir") berakhir += 1;
      used += promo.used;
      quota += promo.quota;
    }
    return { aktif, used, quota, berakhir, sisa: quota - used };
  }, []);

  const filtered = useMemo(
    () =>
      filter === "Semua"
        ? PROMOS
        : PROMOS.filter((promo) => promo.status === filter),
    [filter],
  );

  const columns: TableColumn<Promo>[] = [
    {
      key: "code",
      header: "Kode",
      mobile: true,
      cell: (promo) => (
        <span className="inline-flex items-center gap-2">
          <span className="proto-nums rounded-lg border border-dashed border-[var(--p-line)] bg-[var(--p-canvas)] px-2 py-1 font-semibold tracking-wide text-[var(--p-ink)]">
            {promo.code}
          </span>
          <ProtoButton
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              notify(`Kode ${promo.code} disalin`);
            }}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Salin
          </ProtoButton>
        </span>
      ),
    },
    {
      key: "value",
      header: "Potongan",
      mobile: true,
      cell: (promo) => (
        <span className="block">
          <span className="proto-nums font-semibold text-[var(--p-ink)]">
            {promo.value}
          </span>
          <span className="block text-[11px] text-[var(--p-ink-soft)]">
            {promo.kind}
          </span>
        </span>
      ),
    },
    {
      key: "period",
      header: "Periode",
      mobile: true,
      cell: (promo) => (
        <span className="text-[var(--p-ink-soft)]">{promo.period}</span>
      ),
    },
    {
      key: "quota",
      header: "Pemakaian",
      mobile: true,
      cell: (promo) => (
        <span className="block w-full min-w-[150px]">
          <span className="proto-nums mb-1.5 flex items-center justify-between text-[11px] text-[var(--p-ink-soft)]">
            <span>
              {promo.used}/{promo.quota}
            </span>
            <span className="font-semibold text-[var(--p-ink)]">
              {Math.round((promo.used / Math.max(promo.quota, 1)) * 100)}%
            </span>
          </span>
          <ProgressBar value={promo.used} max={promo.quota} />
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: true,
      cell: (promo) => (
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PROMO_TONE[promo.status]}`}
        >
          {promo.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Promo"
        description="Kode diskon untuk mendorong penjualan undangan digital beserta kuota pemakaiannya."
        actions={
          <ProtoButton
            variant="primary"
            onClick={() => notify("Form promo baru dibuka")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Buat Promo
          </ProtoButton>
        }
      />

      <StatGrid>
        <StatTile
          label="Promo Aktif"
          value={String(stats.aktif)}
          hint="Sedang berjalan"
          icon={<Megaphone className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Total Pemakaian"
          value={String(stats.used)}
          hint="Kode terpakai"
          tone="emerald"
          icon={<Ticket className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Sisa Kuota"
          value={String(stats.sisa)}
          hint={`Dari ${stats.quota} kuota`}
          tone="sky"
          icon={<Zap className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Berakhir"
          value={String(stats.berakhir)}
          hint="Perlu diganti"
          tone="amber"
          icon={<Percent className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--p-line)] bg-white p-4 shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] sm:flex-row sm:items-end sm:justify-between md:p-5">
        <FilterSelect
          label="Filter status promo"
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          className="w-full sm:w-52"
        />
        <p className="text-[11px] text-[var(--p-ink-soft)]">
          Menampilkan {filtered.length} dari {PROMOS.length} promo
        </p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
        <DataTable
          rows={filtered}
          columns={columns}
          caption="Daftar promo"
          minWidth="min-w-[860px]"
          empty={
            <EmptyState
              icon={<Megaphone className="h-5 w-5" aria-hidden="true" />}
              title="Tidak ada promo"
              description="Belum ada promo dengan status ini."
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
