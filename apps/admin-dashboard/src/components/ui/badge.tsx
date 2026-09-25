import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-panel-muted)] px-2.5 py-1 text-[0.68rem] font-extrabold tracking-[0.02em] text-[var(--color-ink-soft)]",
        className,
      )}
      {...props}
    />
  );
}
