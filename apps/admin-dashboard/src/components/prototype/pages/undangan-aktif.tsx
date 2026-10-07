"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ExternalLink,
  Eye,
  Heart,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  INVITATIONS,
  formatDate,
  formatNumber,
  type Invitation,
  type InvitationStatus,
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

type InvitationFilter = InvitationStatus | "Semua";

const INVITATION_TONE: Record<InvitationStatus, string> = {
  Aktif: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Akan Kedaluwarsa": "border-amber-200 bg-amber-50 text-amber-700",
  Draf: "border-stone-200 bg-stone-100 text-stone-600",
  Kedaluwarsa: "border-rose-200 bg-rose-50 text-rose-700",
};

const FILTER_OPTIONS: readonly { value: InvitationFilter; label: string }[] = [
  { value: "Semua", label: "Semua status" },
  { value: "Aktif", label: "Aktif" },
  { value: "Akan Kedaluwarsa", label: "Akan Kedaluwarsa" },
  { value: "Draf", label: "Draf" },
  { value: "Kedaluwarsa", label: "Kedaluwarsa" },
];

/* -------------------------------------------------------------------------- */
/* Undangan Aktif                                                              */
/* -------------------------------------------------------------------------- */

export function UndanganAktifPage() {
  const { notify } = usePrototype();
  const [filter, setFilter] = useState<InvitationFilter>("Semua");

  const stats = useMemo(() => {
    let aktif = 0;
    let expiring = 0;
    let draf = 0;
    let views = 0;
    for (const invitation of INVITATIONS) {
      if (invitation.status === "Aktif") aktif += 1;
      if (invitation.status === "Akan Kedaluwarsa") expiring += 1;
      if (invitation.status === "Draf") draf += 1;
      views += invitation.views;
    }
    return { aktif, expiring, draf, views };
  }, []);

  const filtered = useMemo(
    () =>
      filter === "Semua"
        ? INVITATIONS
        : INVITATIONS.filter((invitation) => invitation.status === filter),
    [filter],
  );

  const columns: TableColumn<Invitation>[] = [
    {
      key: "event",
      header: "Undangan",
      mobile: true,
      cell: (invitation) => (
        <span className="block">
          <span className="proto-display block truncate font-semibold text-[var(--p-ink)]">
            {invitation.event}
          </span>
          <span className="proto-nums block text-[11px] text-[var(--p-ink-soft)]">
            {invitation.id}
          </span>
        </span>
      ),
    },
    {
      key: "customer",
      header: "Pelanggan",
      mobile: true,
      cell: (invitation) => (
        <span className="text-[var(--p-ink-soft)]">{invitation.customer}</span>
      ),
    },
    {
      key: "template",
      header: "Template",
      cell: (invitation) => (
        <span className="text-[var(--p-ink-soft)]">{invitation.template}</span>
      ),
    },
    {
      key: "published",
      header: "Terbit",
      cell: (invitation) => (
        <span className="proto-nums text-[var(--p-ink-soft)]">
          {formatDate(invitation.publishedAt)}
        </span>
      ),
    },
    {
      key: "expires",
      header: "Kedaluwarsa",
      mobile: true,
      cell: (invitation) => (
        <span className="proto-nums text-[var(--p-ink-soft)]">
          {formatDate(invitation.expiresAt)}
        </span>
      ),
    },
    {
      key: "views",
      header: "Tampilan",
      align: "right",
      mobile: true,
      cell: (invitation) => (
        <span className="proto-nums font-semibold text-[var(--p-ink)]">
          {invitation.views}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: true,
      cell: (invitation) => (
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${INVITATION_TONE[invitation.status]}`}
        >
          {invitation.status}
        </span>
      ),
    },
    {
      key: "action",
      header: "Aksi",
      align: "right",
      cell: (invitation) => (
        <ProtoButton
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            notify(`Undangan ${invitation.event} dibuka`);
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Buka
        </ProtoButton>
      ),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Undangan Aktif"
        description="Pantau undangan yang sudah terbit, jumlah kunjungan, dan masa aktifnya."
      />

      <StatGrid>
        <StatTile
          label="Undangan Aktif"
          value={String(stats.aktif)}
          hint="Sedang tayang"
          icon={<Heart className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Akan Kedaluwarsa"
          value={String(stats.expiring)}
          hint="Kurang dari 7 hari"
          tone="amber"
          icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Draf"
          value={String(stats.draf)}
          hint="Belum dipublikasikan"
          tone="sky"
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Total Tampilan"
          value={formatNumber(stats.views)}
          hint="Seluruh undangan"
          tone="emerald"
          icon={<Eye className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      {stats.expiring > 0 ? (
        <div className="flex flex-col gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-amber-900">
                {stats.expiring} undangan akan kedaluwarsa
              </p>
              <p className="text-[11px] text-amber-800/80">
                Tawarkan perpanjangan masa aktif sebelum undangan tidak bisa
                diakses tamu.
              </p>
            </div>
          </div>
          <ProtoButton
            size="sm"
            onClick={() => notify("Pengingat perpanjangan disiapkan")}
          >
            Kirim Pengingat
          </ProtoButton>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--p-line)] bg-white p-4 shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] sm:flex-row sm:items-end sm:justify-between md:p-5">
        <FilterSelect
          label="Filter status undangan"
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          className="w-full sm:w-56"
        />
        <p className="text-[11px] text-[var(--p-ink-soft)]">
          Menampilkan {filtered.length} dari {INVITATIONS.length} undangan
        </p>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
        <DataTable
          rows={filtered}
          columns={columns}
          caption="Daftar undangan aktif"
          minWidth="min-w-[980px]"
          empty={
            <EmptyState
              icon={<Heart className="h-5 w-5" aria-hidden="true" />}
              title="Tidak ada undangan"
              description="Belum ada undangan dengan status ini."
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
