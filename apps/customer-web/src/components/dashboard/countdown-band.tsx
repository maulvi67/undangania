import {
  countdownText,
  type DashboardAggregate,
} from "../../lib/dashboard/contract";

export function CountdownBand({
  aggregate,
  today,
}: {
  aggregate: DashboardAggregate;
  today: string;
}) {
  const countdown = countdownText(
    aggregate.workspace.weddingDate,
    aggregate.workspace.timezone,
    today,
  );

  return (
    <section className="dash-countdown" aria-labelledby="dash-countdown-title">
      <div>
        <p className="dash-countdown__eyebrow" id="dash-countdown-title">
          Menuju hari pernikahan
        </p>
        <p className="dash-countdown__context">
          {aggregate.workspace.coupleNames ?? "Workspace pernikahan Anda"}
        </p>
      </div>
      <p className="dash-countdown__label">{countdown.label}</p>
    </section>
  );
}
