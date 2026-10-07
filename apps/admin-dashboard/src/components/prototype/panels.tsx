"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock,
  CreditCard,
  FileText,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Send,
  ShoppingCart,
  Sparkles,
  Star,
} from "lucide-react";
import { cn } from "../ui/cn";
import { SalesChart, CategoryDonut } from "./charts";
import {
  ACTIVITIES,
  ATTENTION_ITEMS,
  getTemplateGradient,
  ORDER_STATUS_COUNTS,
  POPULAR_TEMPLATES,
  QUICK_ACTIONS,
  TOTAL_ORDER_COUNT,
  type ActivityTone,
  type AttentionItem,
  type AttentionTone,
  type ChartMetric,
  type ChartPeriod,
  type OrderStatus,
  type QuickActionKey,
} from "./data";
import {
  DeltaChip,
  EmptyState,
  ErrorState,
  IconButton,
  OrderBadge,
  ProtoButton,
  ProtoCard,
  SectionHeading,
  SegmentedControl,
  Skeleton,
} from "./ui";

/* -------------------------------------------------------------------------- */
/* Perlu Perhatian                                                             */
/* -------------------------------------------------------------------------- */

const ATTENTION_ICON: Record<AttentionItem["key"], LucideIcon> = {
  payments: CreditCard,
  newOrders: Package,
  eventData: CalendarClock,
  messages: MessageCircle,
  expiring: Clock,
};

const ATTENTION_TONE: Record<AttentionTone, string> = {
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

export function AttentionPanel({
  onAction,
}: {
  onAction: (item: AttentionItem) => void;
}) {
  return (
    <ProtoCard className="flex h-full flex-col p-5">
      <SectionHeading
        title="Perlu Perhatian"
        description="Prioritas operasional hari ini"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            {ATTENTION_ITEMS.length} antrean
          </span>
        }
      />

      <ul className="mt-4 space-y-2">
        {ATTENTION_ITEMS.map((item) => {
          const Icon = ATTENTION_ICON[item.key];
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onAction(item)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border border-[var(--p-line)] p-3 text-left transition",
                  "hover:border-[var(--p-rose)]/30 hover:bg-[var(--p-rose-soft)] active:translate-y-px",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                    ATTENTION_TONE[item.tone],
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="proto-nums proto-display text-base font-semibold text-[var(--p-ink)]">
                      {item.count}
                    </span>
                    <span className="text-[13px] font-semibold text-[var(--p-ink)]">
                      {item.label}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--p-ink-soft)]">
                    {item.detail}
                  </span>
                </span>

                <ChevronRight
                  className="mt-1 h-4 w-4 shrink-0 text-[var(--p-ink-soft)]"
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </ProtoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Aksi Cepat                                                                  */
/* -------------------------------------------------------------------------- */

const QUICK_ACTION_ICON: Record<QuickActionKey, LucideIcon> = {
  template: Plus,
  order: ShoppingCart,
  verify: BadgeCheck,
  broadcast: Megaphone,
  report: FileText,
  message: Send,
};

export function QuickActions({
  onAction,
}: {
  onAction: (key: QuickActionKey, label: string) => void;
}) {
  return (
    <ProtoCard className="flex h-full flex-col p-5">
      <SectionHeading title="Aksi Cepat" description="Pintasan tugas rutin" />

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {QUICK_ACTIONS.map((action) => {
          const Icon = QUICK_ACTION_ICON[action.key];
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => onAction(action.key, action.label)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl border border-[var(--p-line)] p-3 text-left transition",
                "hover:border-[var(--p-rose)]/30 hover:bg-[var(--p-rose-soft)] active:translate-y-px",
              )}
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--p-rose-soft)] text-[var(--p-rose-strong)]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-[var(--p-ink)]">
                  {action.label}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-[var(--p-ink-soft)]">
                  {action.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </ProtoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Ringkasan status pesanan                                                    */
/* -------------------------------------------------------------------------- */

const STATUS_BAR_COLOR: Record<OrderStatus, string> = {
  Baru: "#7FB3D5",
  "Menunggu Data": "#E0B252",
  Diproses: "#8E9BE0",
  "Siap Ditinjau": "#B49BE0",
  Selesai: "#7FB894",
  Dibatalkan: "#E08B8B",
};

export function OrderStatusSummary({
  activeStatus,
  onSelect,
}: {
  activeStatus: OrderStatus | "Semua";
  onSelect: (status: OrderStatus) => void;
}) {
  return (
    <ProtoCard className="flex h-full flex-col p-5">
      <SectionHeading
        title="Status Pesanan"
        description={`Distribusi ${TOTAL_ORDER_COUNT} pesanan`}
      />

      <div
        className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label="Distribusi status pesanan"
      >
        {ORDER_STATUS_COUNTS.map((entry) => (
          <span
            key={entry.status}
            style={{
              width: `${(entry.count / TOTAL_ORDER_COUNT) * 100}%`,
              background: STATUS_BAR_COLOR[entry.status],
            }}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-1">
        {ORDER_STATUS_COUNTS.map((entry) => {
          const active = activeStatus === entry.status;
          return (
            <li key={entry.status}>
              <button
                type="button"
                onClick={() => onSelect(entry.status)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition",
                  active
                    ? "bg-[var(--p-rose-soft)]"
                    : "hover:bg-[var(--p-rose-soft)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: STATUS_BAR_COLOR[entry.status] }}
                />
                <span className="min-w-0 flex-1">
                  <OrderBadge status={entry.status} />
                </span>
                <span className="proto-nums text-xs font-semibold text-[var(--p-ink)]">
                  {entry.count}
                </span>
                <span className="proto-nums w-10 text-right text-[11px] text-[var(--p-ink-soft)]">
                  {Math.round((entry.count / TOTAL_ORDER_COUNT) * 100)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ProtoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Template terpopuler                                                         */
/* -------------------------------------------------------------------------- */

export function PopularTemplates({
  onOpen,
}: {
  onOpen: (name: string) => void;
}) {
  return (
    <ProtoCard className="flex h-full flex-col p-5">
      <SectionHeading
        title="Template Terpopuler"
        description="6 terlaris dari 56 template aktif"
        action={
          <ProtoButton size="sm" variant="ghost" onClick={() => onOpen("")}>
            Lihat semua
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </ProtoButton>
        }
      />

      <ul className="proto-scrollbar-none mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
        {POPULAR_TEMPLATES.map((template) => (
          <li
            key={template.id}
            className="w-[190px] shrink-0 snap-start sm:w-auto"
          >
            <button
              type="button"
              onClick={() => onOpen(template.name)}
              className="group w-full overflow-hidden rounded-2xl border border-[var(--p-line)] bg-white text-left transition hover:border-[var(--p-rose)]/40 active:translate-y-px"
            >
              <span
                aria-hidden="true"
                className="relative block h-[92px] w-full"
                style={{ background: getTemplateGradient(template.name) }}
              >
                <span className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                <span className="proto-display absolute bottom-2 left-3 right-3 truncate text-[13px] font-semibold text-white">
                  {template.name}
                </span>
              </span>

              <span className="block p-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-[var(--p-ink-soft)]">
                    {template.category}
                  </span>
                  <DeltaChip value={template.trend} />
                </span>
                <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--p-ink-soft)]">
                  <span className="proto-nums">{template.sales} terjual</span>
                  <span className="inline-flex items-center gap-1">
                    <Star
                      className="h-3 w-3 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                    <span className="proto-nums font-semibold text-[var(--p-ink)]">
                      {template.rating}
                    </span>
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ProtoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Aktivitas terbaru                                                           */
/* -------------------------------------------------------------------------- */

const ACTIVITY_TONE: Record<ActivityTone, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-[var(--p-rose)]",
  violet: "bg-violet-500",
  stone: "bg-stone-400",
};

type ActivityState = "ready" | "loading" | "error";

/**
 * Demonstrates the three async states on demand: the first refresh always
 * fails so the error state is reachable without the default view looking
 * broken; pressing "Coba lagi" then succeeds.
 */
export function RecentActivity({
  onNotify,
}: {
  onNotify: (message: string) => void;
}) {
  const [state, setState] = useState<ActivityState>("ready");
  const [hasFailedOnce, setHasFailedOnce] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function handleRefresh() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setState("loading");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (hasFailedOnce) {
        setState("ready");
        onNotify("Aktivitas terbaru berhasil dimuat ulang");
      } else {
        setHasFailedOnce(true);
        setState("error");
      }
    }, 900);
  }

  return (
    <ProtoCard className="flex h-full flex-col p-5">
      <SectionHeading
        title="Aktivitas Terbaru"
        description="Jejak tindakan admin dan sistem"
        action={
          <IconButton
            label="Muat ulang aktivitas"
            className="h-9 w-9"
            onClick={handleRefresh}
            disabled={state === "loading"}
          >
            <RefreshCw
              className={cn("h-4 w-4", state === "loading" && "animate-spin")}
              aria-hidden="true"
            />
          </IconButton>
        }
      />

      {state === "loading" ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-start gap-3">
              <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-2.5 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Gagal memuat aktivitas"
          description="Koneksi ke layanan aktivitas terputus. Coba muat ulang sebentar lagi."
          onRetry={handleRefresh}
        />
      ) : null}

      {state === "ready" ? (
        <ol className="mt-4 space-y-3">
          {ACTIVITIES.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  ACTIVITY_TONE[item.tone],
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-relaxed text-[var(--p-ink)]">
                  <span className="font-semibold">{item.actor}</span>{" "}
                  {item.action}{" "}
                  <span className="font-semibold">{item.target}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--p-ink-soft)]">
                  {item.time}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </ProtoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Grafik penjualan + kategori                                                 */
/* -------------------------------------------------------------------------- */

export function SalesPanel({
  metric,
  period,
  onMetricChange,
  onPeriodChange,
  periodLongLabel,
  periodTotal,
  isLoading,
}: {
  metric: ChartMetric;
  period: ChartPeriod;
  onMetricChange: (next: ChartMetric) => void;
  onPeriodChange: (next: ChartPeriod) => void;
  periodLongLabel: string;
  periodTotal: string;
  isLoading: boolean;
}) {
  return (
    <ProtoCard className="flex h-full flex-col p-5">
      <SectionHeading
        title="Grafik Penjualan"
        description={`Tren ${periodLongLabel}`}
        action={
          <SegmentedControl
            ariaLabel="Pilih metrik grafik"
            options={[
              { value: "income", label: "Pendapatan" },
              { value: "orders", label: "Pesanan" },
            ]}
            value={metric}
            onChange={onMetricChange}
          />
        }
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="proto-nums proto-display text-2xl font-semibold text-[var(--p-ink)]">
            {periodTotal}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--p-ink-soft)]">
            Total {metric === "income" ? "pendapatan" : "pesanan"} ·{" "}
            {periodLongLabel}
          </p>
        </div>
        <SegmentedControl
          ariaLabel="Pilih rentang waktu"
          size="sm"
          options={[
            { value: "7h", label: "7 Hari" },
            { value: "30h", label: "30 Hari" },
            { value: "3b", label: "3 Bulan" },
            { value: "1t", label: "1 Tahun" },
          ]}
          value={period}
          onChange={onPeriodChange}
        />
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-[240px] w-full rounded-2xl sm:h-[280px]" />
        ) : (
          <SalesChart metric={metric} period={period} />
        )}
      </div>
    </ProtoCard>
  );
}

export function CategoryPanel({ isLoading }: { isLoading: boolean }) {
  return (
    <ProtoCard className="flex h-full flex-col p-5">
      <SectionHeading
        title="Kategori Template"
        description="Sebaran pesanan per gaya desain"
      />
      <div className="mt-4 flex-1">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="mx-auto h-[188px] w-[188px] rounded-full" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <Skeleton key={row} className="h-3 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <CategoryDonut />
        )}
      </div>
    </ProtoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* KPI cards                                                                   */
/* -------------------------------------------------------------------------- */

export function KpiCard({
  label,
  value,
  delta,
  caption,
  icon,
}: {
  label: string;
  value: string;
  delta: number;
  caption: string;
  icon: ReactNode;
}) {
  return (
    <ProtoCard className="min-w-[212px] snap-start p-4 sm:min-w-0 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--p-ink-soft)]">
            {label}
          </p>
          <p className="proto-nums proto-display mt-2 truncate text-[22px] font-semibold text-[var(--p-ink)] sm:text-2xl">
            {value}
          </p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--p-rose-soft)] text-[var(--p-rose-strong)]">
          {icon}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DeltaChip value={delta} />
        <span className="text-[11px] text-[var(--p-ink-soft)]">{caption}</span>
      </div>
    </ProtoCard>
  );
}

export function KpiSkeleton() {
  return (
    <ProtoCard className="min-w-[212px] snap-start p-4 sm:min-w-0 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-10 w-10 rounded-2xl" />
      </div>
      <Skeleton className="mt-3 h-4 w-28" />
    </ProtoCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Section-level loading / empty wrappers                                      */
/* -------------------------------------------------------------------------- */

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ProtoCard className="p-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-2xl" />
        ))}
      </div>
    </ProtoCard>
  );
}

export function NoDataState({ onRetry }: { onRetry: () => void }) {
  return (
    <ProtoCard>
      <EmptyState
        icon={<Sparkles className="h-6 w-6" aria-hidden="true" />}
        title="Belum ada data untuk periode ini"
        description="Coba pilih rentang waktu lain, atau muat ulang untuk menarik data terbaru."
        action={
          <ProtoButton size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Muat ulang
          </ProtoButton>
        }
      />
    </ProtoCard>
  );
}
