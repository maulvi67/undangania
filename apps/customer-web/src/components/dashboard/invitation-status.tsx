import { Badge, type BadgeTone } from "@wedding/ui";
import {
  formatActivePeriod,
  type DashboardAggregate,
  type DerivedStatus,
} from "../../lib/dashboard/contract";

const ACTIVE_STATES = new Set(["PUBLISHED", "PAUSED", "EXPIRING", "EXPIRED"]);

export function InvitationStatus({
  aggregate,
  status,
  today,
}: {
  aggregate: DashboardAggregate;
  status: DerivedStatus;
  today: string;
}) {
  const invitation =
    aggregate.invitation.status === "ok" ? aggregate.invitation.data : null;
  const activePeriod = ACTIVE_STATES.has(status.state)
    ? formatActivePeriod(aggregate.workspace.weddingDate, today)
    : null;

  return (
    <section className="dash-section" aria-labelledby="dash-invitation-title">
      <div className="dash-section__head">
        <div>
          <p className="dash-section__eyebrow">Ringkasan</p>
          <h2 className="dash-section__title" id="dash-invitation-title">
            Status undangan
          </h2>
        </div>
        <Badge tone={status.tone as BadgeTone}>{status.label}</Badge>
      </div>

      {invitation === null ? (
        <p className="dash-section__body">
          Status undangan belum tersedia. Lengkapi data dasar untuk mulai
          menyusunnya.
        </p>
      ) : (
        <>
          <p className="dash-section__body">{status.reason}</p>
          <dl className="dash-definition-list">
            {invitation.templateName !== null ? (
              <div className="dash-definition-list__row">
                <dt>Desain</dt>
                <dd>{invitation.templateName}</dd>
              </div>
            ) : null}
            <div className="dash-definition-list__row">
              <dt>Konten</dt>
              <dd>
                {invitation.contentComplete ? "Lengkap" : "Masih disusun"}
              </dd>
            </div>
            {aggregate.workspace.city !== null ? (
              <div className="dash-definition-list__row">
                <dt>Lokasi workspace</dt>
                <dd>{aggregate.workspace.city}</dd>
              </div>
            ) : null}
          </dl>
          <p className="dash-status-note">
            {activePeriod ??
              "Masa aktif dimulai saat undangan diterbitkan dan berakhir 30 hari setelah tanggal acara."}
          </p>
          {invitation.publicUrl !== null ? (
            <div className="dash-public-url">
              <span className="dash-public-url__label">Alamat publik</span>
              <code>{invitation.publicUrl}</code>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
