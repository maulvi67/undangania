import {
  formatNumber,
  type DashboardAggregate,
} from "../../lib/dashboard/contract";

export function RsvpSummary({ aggregate }: { aggregate: DashboardAggregate }) {
  return (
    <section className="dash-section" aria-labelledby="dash-rsvp-title">
      <div className="dash-section__head">
        <div>
          <p className="dash-section__eyebrow">Tamu undangan</p>
          <h2 className="dash-section__title" id="dash-rsvp-title">
            Konfirmasi kehadiran
          </h2>
        </div>
      </div>

      {aggregate.rsvp.status === "unavailable" ? (
        <div className="dash-inline-error" role="alert">
          <p className="dash-inline-error__title">
            Ringkasan RSVP belum tersedia.
          </p>
          <p>
            <a href="/rsvp">Kelola konfirmasi</a> atau{" "}
            <a href="/dashboard">muat ulang</a> halaman ini.
          </p>
        </div>
      ) : (
        <>
          {aggregate.rsvp.data.invited === 0 ? (
            <p className="dash-summary__empty">Belum ada tamu yang menjawab.</p>
          ) : (
            <p className="dash-summary__lead">
              {formatNumber(
                Math.max(
                  0,
                  aggregate.rsvp.data.invited - aggregate.rsvp.data.pending,
                ),
              )}{" "}
              dari {formatNumber(aggregate.rsvp.data.invited)} tamu sudah
              menjawab.
            </p>
          )}
          <dl className="dash-definition-list dash-definition-list--summary">
            <div className="dash-definition-list__row">
              <dt>Hadir</dt>
              <dd>{formatNumber(aggregate.rsvp.data.attending)}</dd>
            </div>
            <div className="dash-definition-list__row">
              <dt>Berhalangan</dt>
              <dd>{formatNumber(aggregate.rsvp.data.declined)}</dd>
            </div>
            <div className="dash-definition-list__row">
              <dt>Mungkin</dt>
              <dd>{formatNumber(aggregate.rsvp.data.tentative)}</dd>
            </div>
            <div className="dash-definition-list__row">
              <dt>Belum menjawab</dt>
              <dd>{formatNumber(aggregate.rsvp.data.pending)}</dd>
            </div>
          </dl>
          <a className="dash-section-link" href="/rsvp">
            Kelola konfirmasi
          </a>
        </>
      )}
    </section>
  );
}
