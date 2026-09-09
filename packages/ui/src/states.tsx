import type { ReactNode } from "react";
import { cx } from "./cx";
import { IconAlert, IconInbox, Spinner } from "./icons";

export function Skeleton({
  className,
  circle = false,
  width,
  height,
}: {
  className?: string;
  circle?: boolean;
  width?: string;
  height?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("ui-skeleton", circle ? "ui-skeleton--circle" : undefined, className)}
      style={{ width, height }}
    />
  );
}

export function LoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div className="ui-stack" role="status" aria-live="polite">
      <span className="ui-visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div className="ui-loading-row" key={index}>
          <Skeleton className="ui-loading-row__avatar" circle />
          <span className="ui-loading-row__lines">
            <Skeleton height="0.875rem" width="45%" />
            <Skeleton height="0.75rem" width="30%" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SpinnerState({ label }: { label: string }) {
  return (
    <div className="ui-stack" role="status" aria-live="polite" style={{ alignItems: "center", padding: "var(--space-8)" }}>
      <Spinner />
      <span className="ui-visually-hidden">{label}</span>
    </div>
  );
}

export type StatePanelProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "danger";
};

export function StatePanel({ icon, title, description, action, tone = "default" }: StatePanelProps) {
  return (
    <div className={cx("ui-state-panel", tone === "danger" ? "ui-state-panel--danger" : undefined)}>
      <span className="ui-state-panel__icon" aria-hidden="true">
        {icon ?? <IconInbox />}
      </span>
      <h3 className="ui-state-panel__title">{title}</h3>
      <p className="ui-state-panel__description">{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <StatePanel icon={<IconInbox />} title={title} description={description} action={action} />;
}

export function ErrorState({
  title = "Terjadi kesalahan",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <StatePanel icon={<IconAlert />} tone="danger" title={title} description={description} action={action} />
  );
}
