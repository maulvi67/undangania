"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CircleCheck,
  CircleGauge,
  MapPin,
  TriangleAlert,
  Pencil,
} from "lucide-react";
import {
  EVENTS,
  formatDate,
  type EventCompleteness,
  type EventRecord,
} from "../data";
import { DataTable, type TableColumn } from "../table";
import { usePrototype } from "../store";
import {
  EmptyState,
  FilterSelect,
  PageHeader,
  ProtoButton,
  StatGrid,
  StatTile,
} from "../ui";

type EventFilter = EventCompleteness | "Semua";

const FILTER_OPTIONS: readonly { value: EventFilter; label: string }[] = [
  { value: "Semua", label: "Semua kelengkapan" },
  { value: "Lengkap", label: "Lengkap" },
  { value: "Belum Lengkap", label: "Belum Lengkap" },
];

/* -------------------------------------------------------------------------- */
/* Data Acara                                                                  */
/* -------------------------------------------------------------------------- */

export function DataAcaraPage() {
  const { notify } = usePrototype();
  const [filter, setFilter] = useState<EventFilter>("Semua");

  const stats = useMemo(() => {
    let lengkap = 0;
    let belum = 0;
    for (const record of EVENTS) {
      if (record.completeness === "Lengkap") lengkap += 1;
      if (record.completeness === "Belum Lengkap") belum += 1;
    }
    const total = EVENTS.length;
    return {
      lengkap,
      belum,
      percent: total === 0 ? 0 : Math.round((lengkap / total) * 100),
    };
  }, []);

  const filtered = useMemo(
    () =>
      filter === "Semua"
        ? EVENTS
        : EVENTS.filter((record) => record.completeness === filter),
    [filter],
  );

  const columns: TableColumn<EventRecord>[] = [
    {
      key: "event",
      header: "Acara",
      mobile: true,
      cell: (record) => (
        <span className="block">
          <span className="proto-display block truncate font-semibold text-[var(--p-ink)]">
            {record.event}
          </span>
          <span className="proto-nums block text-[11px] text-[var(--p-ink-soft)]">
            {record.orderId} · {record.template}
          </span>
        </span>
      ),
    },
    {
      key: "date",
      header: "Tanggal Acara",
      mobile: true,
      cell: (record) => (
        <span className="proto-nums text-[var(--p-ink-soft)]">
          {formatDate(record.eventDate)}
        </span>
      ),
    },
    {
      key: "city",
      header: "Kota",
      mobile: true,
      cell: (record) => (
        <span className="text-[var(--p-ink-soft)]">{record.city}</span>
      ),
    },
    {
      key: "venue",
      header: "Lokasi",
      cell: (record) => (
        <span className="inline-flex items-center gap-1.5 text-[var(--p-ink-soft)]">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {record.venue}
        </span>
      ),
    },
    {
      key: "completeness",
      header: "Kelengkapan",
      mobile: true,
      cell: (record) =>
        record.completeness === "Lengkap" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <CircleCheck className="h-3 w-3" aria-hidden="true" />
            Lengkap
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
            Belum Lengkap
          </span>
        ),
    },
    {
      key: "missing",
      header: "Data Kurang",
      mobile: true,
      cell: (record) => (
        <span className="text-[11px] text-[var(--p-ink-soft)]">
          {record.missing.length === 0
            ? "Tidak ada"
            : record.missing.join(", ")}
        </span>
      ),
    },
    {
      key: "action",
      header: "Aksi",
      align: "right",
      cell: (record) => (
        <ProtoButton
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            notify(`Form data acara ${record.event} dibuka`);
          }}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {record.completeness === "Lengkap" ? "Ubah" : "Lengkapi"}
        </ProtoButton>
      ),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Data Acara"
        description="Data pasangan, tanggal, dan lokasi yang dipakai untuk menyusun isi undangan."
      />

      <StatGrid>
        <StatTile
          label="Total Acara"
          value={String(EVENTS.length)}
          hint="Terhubung ke pesanan"
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Lengkap"
          value={String(stats.lengkap)}
          hint="Siap digarap"
          tone="emerald"
          icon={<CircleCheck className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Belum Lengkap"
          value={String(stats.belum)}
          hint="Perlu ditagih ke pelanggan"
          tone="amber"
          icon={<TriangleAlert className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Kelengkapan"
          value={`${stats.percent}%`}
          hint="Data acara siap produksi"
          tone="sky"
          icon={<CircleGauge className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      {stats.belum > 0 ? (
        <div className="flex flex-col gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-amber-900">
                {stats.belum} data acara belum lengkap
              </p>
              <p className="text-[11px] text-amber-800/80">
                Undangan tidak bisa mulai dikerjakan sebelum data ini diterima.
              </p>
            </div>
          </div>
          <ProtoButton
            size="sm"
            onClick={() => notify("Pesan penagihan data disiapkan")}
          >
            Tagih Data
          </ProtoButton>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--p-line)] bg-white p-4 shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] sm:flex-row sm:items-end sm:justify-between md:p-5">
        <FilterSelect
          label="Filter kelengkapan"
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          className="w-full sm:w-56"
        />
        <p className="text-[11px] text-[var(--p-ink-soft)]">
          Menampilkan {filtered.length} dari {EVENTS.length} acara
        </p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
        <DataTable
          rows={filtered}
          columns={columns}
          caption="Daftar data acara"
          minWidth="min-w-[1020px]"
          empty={
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
              title="Tidak ada acara"
              description="Belum ada acara dengan kelengkapan ini."
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
