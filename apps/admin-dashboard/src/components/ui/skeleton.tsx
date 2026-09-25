import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--color-line)]/70", className)} aria-hidden="true" />;
}
