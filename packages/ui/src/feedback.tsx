import type { ReactNode } from "react";
import { cx } from "./cx";
import { IconAlert, IconCheck, IconInfo } from "./icons";

export type AlertVariant = "info" | "success" | "warning" | "error";

export type AlertProps = {
  variant?: AlertVariant;
  title: string;
  children?: ReactNode;
};

const alertIcons: Record<AlertVariant, ReactNode> = {
  info: <IconInfo />,
  success: <IconCheck />,
  warning: <IconAlert />,
  error: <IconAlert />,
};

export function Alert({ variant = "info", title, children }: AlertProps) {
  return (
    <div className={cx("ui-alert", `ui-alert--${variant}`)} role={variant === "error" ? "alert" : "status"}>
      <span className="ui-alert__icon" aria-hidden="true">
        {alertIcons[variant]}
      </span>
      <div>
        <p className="ui-alert__title">{title}</p>
        {children ? <div className="ui-alert__body">{children}</div> : null}
      </div>
    </div>
  );
}

export type BadgeTone = "neutral" | "olive" | "gold" | "blush";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx("ui-badge", `ui-badge--${tone}`)}>{children}</span>;
}

export function Toast({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="ui-toast" role="status">
      <span className="ui-toast__icon" aria-hidden="true">
        <IconCheck />
      </span>
      <p className="ui-toast__text">{children}</p>
    </div>
  );
}
