import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-[var(--color-accent-strong)] text-white shadow-[0_1px_2px_rgb(24_39_31_/_0.12)] hover:bg-[var(--color-accent)]",
  secondary: "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] shadow-none hover:border-[var(--color-accent)] hover:bg-[var(--color-panel-muted)]",
  ghost: "border-transparent bg-transparent text-[var(--color-ink-soft)] shadow-none hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-ink)]",
  danger: "border-transparent bg-[var(--color-danger)] text-white shadow-[0_1px_2px_rgb(24_39_31_/_0.12)] hover:bg-[#863b2b]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition hover:-translate-y-px active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-11 px-4",
        variants[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
