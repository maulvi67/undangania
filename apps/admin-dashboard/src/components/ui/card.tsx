import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] shadow-[0_1px_2px_rgb(24_39_31_/_0.05),0_12px_28px_rgb(24_39_31_/_0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-5", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}
