import Link from "next/link";
import {
  formatNumber,
  type DashboardAggregate,
} from "../../lib/dashboard/contract";

export function GuestSummary({ aggregate }: { aggregate: DashboardAggregate }) {
  return (
    <section className="dash-section" aria-labelledby="dash-guests-title">
      <div className="dash-section__head">
        <div>
          <p className="dash-section__eyebrow">Daftar undangan</p>
          <h2 className="dash-section__title" id="dash-guests-title">
            Tamu
          </h2>
        </div>
      </div>

      {aggregate.guests.status === "unavailable" ? (
        <div className="dash-inline-error" role="alert">
          <p className="dash-inline-error__title">
            Ringkasan tamu belum tersedia.
          </p>
          <p>
            <Link href="/tamu">Kelola tamu</Link> atau{" "}
            <Link href="/dashboard">muat ulang</Link> halaman ini.
          </p>
        </div>
      ) : aggregate.guests.data.guestCount === 0 ? (
        <>
          <p className="dash-summary__empty">
            Belum ada tamu — impor daftar tamu Anda.
          </p>
          <Link className="dash-section-link" href="/tamu">
            Kelola tamu
          </Link>
        </>
      ) : (
        <>
          <p className="dash-summary__lead">
            {formatNumber(aggregate.guests.data.guestCount)} tamu dalam{" "}
            {formatNumber(aggregate.guests.data.householdCount)} grup.
          </p>
          <p className="dash-section__body">
            Ringkasan ini hanya menampilkan jumlah. Detail tamu tersedia di
            halaman pengelolaan tamu.
          </p>
          <Link className="dash-section-link" href="/tamu">
            Kelola tamu
          </Link>
        </>
      )}
    </section>
  );
}
