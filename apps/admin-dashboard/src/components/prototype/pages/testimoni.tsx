"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Quote, Star, Clock } from "lucide-react";
import {
  TESTIMONIALS,
  formatDate,
  type Testimonial,
  type TestimonialStatus,
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

type TestimonialFilter = TestimonialStatus | "Semua";

const FILTER_OPTIONS: readonly { value: TestimonialFilter; label: string }[] = [
  { value: "Semua", label: "Semua status" },
  { value: "Terbit", label: "Terbit" },
  { value: "Menunggu", label: "Menunggu" },
];

/* -------------------------------------------------------------------------- */
/* Testimoni                                                                   */
/* -------------------------------------------------------------------------- */

export function TestimoniPage() {
  const { notify } = usePrototype();
  const [filter, setFilter] = useState<TestimonialFilter>("Semua");

  const stats = useMemo(() => {
    let terbit = 0;
    let menunggu = 0;
    let ratingTotal = 0;
    for (const testimonial of TESTIMONIALS) {
      if (testimonial.status === "Terbit") terbit += 1;
      if (testimonial.status === "Menunggu") menunggu += 1;
      ratingTotal += testimonial.rating;
    }
    const average =
      TESTIMONIALS.length === 0
        ? 0
        : Math.round((ratingTotal / TESTIMONIALS.length) * 10) / 10;
    return { terbit, menunggu, average };
  }, []);

  const filtered = useMemo(
    () =>
      filter === "Semua"
        ? TESTIMONIALS
        : TESTIMONIALS.filter((testimonial) => testimonial.status === filter),
    [filter],
  );

  const columns: TableColumn<Testimonial>[] = [
    {
      key: "customer",
      header: "Pelanggan",
      mobile: true,
      cell: (testimonial) => (
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--p-rose-soft)] text-[11px] font-semibold text-[var(--p-rose-strong)]"
          >
            {initials(testimonial.customer)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--p-ink)]">
              {testimonial.customer}
            </span>
            <span className="block truncate text-[11px] text-[var(--p-ink-soft)]">
              {testimonial.template}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      mobile: true,
      cell: (testimonial) => (
        <span className="inline-flex items-center gap-1">
          <Star
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            aria-hidden="true"
          />
          <span className="proto-nums font-semibold text-[var(--p-ink)]">
            {testimonial.rating}
          </span>
        </span>
      ),
    },
    {
      key: "message",
      header: "Ulasan",
      mobile: true,
      className: "max-w-[420px]",
      cell: (testimonial) => (
        <span className="block text-[12px] leading-relaxed text-[var(--p-ink-soft)]">
          {testimonial.message}
        </span>
      ),
    },
    {
      key: "date",
      header: "Tanggal",
      cell: (testimonial) => (
        <span className="proto-nums text-[var(--p-ink-soft)]">
          {formatDate(testimonial.date)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: true,
      cell: (testimonial) =>
        testimonial.status === "Terbit" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <BadgeCheck className="h-3 w-3" aria-hidden="true" />
            Terbit
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Menunggu
          </span>
        ),
    },
    {
      key: "action",
      header: "Aksi",
      align: "right",
      cell: (testimonial) => (
        <ProtoButton
          size="sm"
          variant={testimonial.status === "Menunggu" ? "primary" : "secondary"}
          onClick={(event) => {
            event.stopPropagation();
            notify(
              testimonial.status === "Menunggu"
                ? `Testimoni ${testimonial.customer} diterbitkan`
                : `Testimoni ${testimonial.customer} disembunyikan`,
            );
          }}
        >
          {testimonial.status === "Menunggu" ? "Terbitkan" : "Sembunyikan"}
        </ProtoButton>
      ),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Testimoni"
        description="Ulasan pelanggan yang tampil di halaman produk untuk membangun kepercayaan calon pembeli."
      />

      <StatGrid>
        <StatTile
          label="Total Testimoni"
          value={String(TESTIMONIALS.length)}
          hint="Dari pelanggan terverifikasi"
          icon={<Quote className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Terbit"
          value={String(stats.terbit)}
          hint="Tampil di halaman produk"
          tone="emerald"
          icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Menunggu"
          value={String(stats.menunggu)}
          hint="Perlu ditinjau"
          tone="amber"
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Rating Rata-rata"
          value={String(stats.average)}
          hint="Dari 5.0"
          tone="sky"
          icon={<Star className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--p-line)] bg-white p-4 shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] sm:flex-row sm:items-end sm:justify-between md:p-5">
        <FilterSelect
          label="Filter status testimoni"
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          className="w-full sm:w-52"
        />
        <p className="text-[11px] text-[var(--p-ink-soft)]">
          Menampilkan {filtered.length} dari {TESTIMONIALS.length} testimoni
        </p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
        <DataTable
          rows={filtered}
          columns={columns}
          caption="Daftar testimoni"
          minWidth="min-w-[900px]"
          empty={
            <EmptyState
              icon={<Quote className="h-5 w-5" aria-hidden="true" />}
              title="Tidak ada testimoni"
              description="Belum ada testimoni dengan status ini."
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

/** "Dewi Anggraini" -> "DA" */
function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
