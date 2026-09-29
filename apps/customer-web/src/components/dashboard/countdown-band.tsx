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

  const dateLabel =
    countdown.kind === "future"
      ? countdown.label.split(" · ").slice(1).join(" · ")
      : countdown.kind === "today"
        ? countdown.label.replace("Hari ini hari pernikahan Anda · ", "")
        : countdown.kind === "undecided"
          ? "Lengkapi profil pernikahan untuk menambahkan tanggal."
          : countdown.label;
  const countLabel =
    countdown.kind === "future"
      ? `H−${countdown.days}`
      : countdown.kind === "today"
        ? "Hari ini"
        : countdown.kind === "past"
          ? "Selesai"
          : "Belum ditentukan";

  return (
    <section className="dash-countdown" aria-labelledby="dash-countdown-title">
      <div className="dash-countdown__copy">
        <p className="dash-countdown__eyebrow" id="dash-countdown-title">
          Menuju hari pernikahan
        </p>
        <p className="dash-countdown__context">
          {aggregate.workspace.coupleNames ?? "Workspace pernikahan Anda"}
        </p>
      </div>
      <div className="dash-countdown__measure">
        <p className="dash-countdown__number">{countLabel}</p>
        <p className="dash-countdown__date">{dateLabel}</p>
      </div>
    </section>
  );
}
