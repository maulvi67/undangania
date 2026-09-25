import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type AlertVariant = "info" | "warning" | "error" | "success";

const styles: Record<AlertVariant, string> = {
  info: "border-[color-mix(in_srgb,var(--color-info)_35%,white)] bg-[#edf5f8] text-[#254e63]",
  warning: "border-[#e7d9ac] bg-[#fff9e8] text-[#70551b]",
  error: "border-[#e6c0b5] bg-[#fff1ec] text-[#833e2e]",
  success: "border-[#b9d9c5] bg-[#eff9f1] text-[#276341]",
};

export function Alert({
  title,
  variant = "info",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string;
  variant?: AlertVariant;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("rounded-xl border px-4 py-3 text-sm shadow-[0_1px_2px_rgb(24_39_31_/_0.04)]", styles[variant], className)}
      role={variant === "error" ? "alert" : "status"}
      {...props}
    >
      <p className="font-extrabold">{title}</p>
      {children ? <div className="mt-1 leading-relaxed">{children}</div> : null}
    </div>
  );
}
