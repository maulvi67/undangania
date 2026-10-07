"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import {
  CircleCheck,
  LoaderCircle,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "../ui/cn";
import type { OrderStatus, PaymentStatus } from "./data";

/* -------------------------------------------------------------------------- */
/* Surface + headings                                                          */
/* -------------------------------------------------------------------------- */

export function ProtoCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--p-line)] bg-white",
        "shadow-[0_18px_44px_-30px_rgba(94,48,56,0.45)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="proto-display text-[17px] font-semibold text-[var(--p-ink)] sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-[var(--p-ink-soft)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status badges                                                               */
/* -------------------------------------------------------------------------- */

const PAYMENT_TONE: Record<PaymentStatus, string> = {
  "Belum Dibayar": "border-stone-200 bg-stone-50 text-stone-600",
  "Menunggu Konfirmasi": "border-amber-200 bg-amber-50 text-amber-700",
  Lunas: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Gagal: "border-rose-200 bg-rose-50 text-rose-700",
  Dikembalikan: "border-sky-200 bg-sky-50 text-sky-700",
};

const ORDER_TONE: Record<OrderStatus, string> = {
  Baru: "border-sky-200 bg-sky-50 text-sky-700",
  "Menunggu Data": "border-amber-200 bg-amber-50 text-amber-700",
  Diproses: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Siap Ditinjau": "border-violet-200 bg-violet-50 text-violet-700",
  Selesai: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Dibatalkan: "border-rose-200 bg-rose-50 text-rose-700",
};

function Badge({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {children}
    </span>
  );
}

export function PayBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status]}>{status}</Badge>;
}

export function OrderBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{status}</Badge>;
}

export function DeltaChip({
  value,
  className,
}: {
  value: number;
  className?: string | undefined;
}) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        positive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
        className,
      )}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
      )}
      {positive ? "+" : ""}
      {value}%
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--p-rose)] text-white hover:bg-[var(--p-rose-strong)] shadow-[0_12px_26px_-16px_rgba(185,83,99,0.95)]",
  secondary:
    "border border-[var(--p-line)] bg-white text-[var(--p-ink)] hover:bg-[var(--p-rose-soft)]",
  ghost:
    "text-[var(--p-ink-soft)] hover:bg-[var(--p-rose-soft)] hover:text-[var(--p-ink)]",
  danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3 text-[13px]",
  md: "h-11 gap-2 px-4 text-sm",
};

export function ProtoButton({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition",
        "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
        "border-[var(--p-line)] bg-white text-[var(--p-ink-soft)] transition",
        "hover:bg-[var(--p-rose-soft)] hover:text-[var(--p-ink)] active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                           */
/* -------------------------------------------------------------------------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap rounded-xl border border-[var(--p-line)] bg-[var(--p-rose-soft)] p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg font-semibold transition",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              active
                ? "bg-white text-[var(--p-rose-strong)] shadow-sm"
                : "text-[var(--p-ink-soft)] hover:text-[var(--p-ink)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog: centred modal on desktop, bottom sheet on mobile                    */
/* -------------------------------------------------------------------------- */

/**
 * Reference-counted body scroll lock. Nested dialogs (order detail + cancel
 * confirmation) would otherwise clobber each other's saved `overflow` value on
 * unmount and leave the page permanently unscrollable.
 */
let scrollLockCount = 0;

function lockBodyScroll() {
  scrollLockCount += 1;
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = "";
  }
}

export function ProtoDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  // Keep the latest handler without re-running the effect below.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    lockBodyScroll();
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      unlockBodyScroll();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  const duration = reduceMotion ? 0 : 0.22;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center lg:p-6">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            onClick={() => onCloseRef.current()}
            className="absolute inset-0 bg-[#2A1A1F]/45 backdrop-blur-[2px]"
          />
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration }}
            className={cn(
              "relative flex max-h-[88dvh] w-full flex-col overflow-hidden outline-none",
              "rounded-t-[24px] border border-[var(--p-line)] bg-white shadow-2xl",
              "lg:max-w-lg lg:rounded-[24px]",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--p-line)] px-5 py-4">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="proto-display text-lg font-semibold text-[var(--p-ink)]"
                >
                  {title}
                </h2>
                {description ? (
                  <p className="mt-0.5 text-xs text-[var(--p-ink-soft)]">
                    {description}
                  </p>
                ) : null}
              </div>
              <IconButton
                label="Tutup"
                onClick={() => onCloseRef.current()}
                className="h-9 w-9 border-transparent bg-transparent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {children}
            </div>

            {footer ? (
              <div className="border-t border-[var(--p-line)] bg-[var(--p-canvas)] px-5 py-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback: toast, skeleton, empty, error                                     */
/* -------------------------------------------------------------------------- */

export function Toast({ message }: { message: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-24 z-[70] mx-auto flex",
        "max-w-sm items-start gap-2.5 rounded-2xl bg-[#2E2024] px-4 py-3",
        "text-sm font-medium text-white shadow-2xl lg:bottom-8",
      )}
    >
      <CircleCheck
        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
        aria-hidden="true"
      />
      <span className="min-w-0">{message}</span>
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string | undefined }) {
  return (
    <div
      aria-hidden="true"
      className={cn("proto-skeleton rounded-lg bg-[#F2E8E4]", className)}
    />
  );
}

export function Spinner({ className }: { className?: string | undefined }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn("h-4 w-4 animate-spin", className)}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--p-rose-soft)] text-[var(--p-rose)]">
        {icon}
      </div>
      <p className="proto-display mt-1 text-base font-semibold text-[var(--p-ink)]">
        {title}
      </p>
      <p className="max-w-xs text-xs leading-relaxed text-[var(--p-ink-soft)]">
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="proto-display mt-1 text-base font-semibold text-[var(--p-ink)]">
        {title}
      </p>
      <p className="max-w-xs text-xs leading-relaxed text-[var(--p-ink-soft)]">
        {description}
      </p>
      <ProtoButton size="sm" className="mt-2" onClick={onRetry}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Coba lagi
      </ProtoButton>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page-level primitives                                                       */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="proto-display text-[26px] font-semibold leading-tight text-[var(--p-ink)] md:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--p-ink-soft)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export type StatTone = "rose" | "emerald" | "amber" | "sky";

const STAT_TONE: Record<StatTone, string> = {
  rose: "bg-[var(--p-rose-soft)] text-[var(--p-rose-strong)]",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
};

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "rose",
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
  tone?: StatTone | undefined;
}) {
  return (
    <ProtoCard className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--p-ink-soft)]">
            {label}
          </p>
          <p className="proto-nums proto-display mt-1.5 truncate text-xl font-semibold text-[var(--p-ink)] sm:text-[22px]">
            {value}
          </p>
        </div>
        {icon ? (
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              STAT_TONE[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-2 text-[11px] text-[var(--p-ink-soft)]">{hint}</p>
      ) : null}
    </ProtoCard>
  );
}

export function StatGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--p-ink-soft)]"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-[var(--p-line)] bg-white pl-9 pr-3 text-[13px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-ink-soft)]/70 focus:border-[var(--p-rose)]"
      />
    </div>
  );
}

export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="text-[11px] font-semibold text-[var(--p-ink-soft)]"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 w-full rounded-xl border border-[var(--p-line)] bg-white px-3 text-[13px] text-[var(--p-ink)] outline-none focus:border-[var(--p-rose)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
