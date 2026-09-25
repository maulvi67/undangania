import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 text-base text-[var(--color-ink)] shadow-none placeholder:text-[var(--color-ink-soft)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[#b9d9c5]",
        className,
      )}
      {...props}
    />
  );
}
