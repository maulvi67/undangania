import Link from "next/link";
import type { AdminDashboard } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { SectionState } from "./section-state";

function SeverityLabel({ severity }: { severity: string }) {
  const labels: Record<string, string> = {
    critical: "Kritis",
    high: "Tinggi",
    warning: "Perhatian",
    info: "Info",
    healthy: "Sehat",
  };
  return (
    <span className={`admin-severity admin-severity--${severity}`}>
      <span className="admin-severity__dot" aria-hidden="true" />
      {labels[severity] ?? severity}
    </span>
  );
}

export function AttentionQueue({
  section,
}: {
  section: AdminDashboard["attention"];
}) {
  return (
    <section
      className="admin-section admin-section--attention"
      id="ringkasan"
      aria-labelledby="attention-title"
    >
      <div className="admin-section__heading">
        <div>
          <p className="admin-eyebrow">Prioritas pertama</p>
          <h2 id="attention-title">Perlu perhatian</h2>
          <p className="admin-section__description">
            Mulai dari isu dengan dampak dan urgensi tertinggi. Setiap item
            memiliki pemilik dan langkah aman berikutnya.
          </p>
        </div>
        {section.status === "ok" ? (
          <span className="admin-section-count">
            {section.rows.length} item simulasi
          </span>
        ) : null}
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState
          status="ok"
          emptyTitle="Tidak ada isu mendesak"
          emptyDescription="Antrean operasional saat ini tidak memiliki item yang perlu ditindaklanjuti."
        />
      ) : (
        <div className="admin-attention-list">
          {section.rows.map((item) => (
            <article
              className={`admin-attention-item admin-attention-item--${item.severity}`}
              key={item.id}
            >
              <div className="admin-attention-item__main">
                <div className="admin-attention-item__meta">
                  <SeverityLabel severity={item.severity} />
                  <span className="admin-reference">{item.reference}</span>
                </div>
                <h3>{item.issue}</h3>
                <p>{item.summary}</p>
              </div>
              <dl className="admin-inline-details">
                <div>
                  <dt>Status</dt>
                  <dd>{item.status}</dd>
                </div>
                <div>
                  <dt>Usia</dt>
                  <dd>{item.age}</dd>
                </div>
                <div>
                  <dt>Pemilik</dt>
                  <dd>{item.owner}</dd>
                </div>
                <div>
                  <dt>Diperbarui</dt>
                  <dd>{formatAdminTimestamp(item.updatedAt)} WIB</dd>
                </div>
              </dl>
              <div className="admin-attention-item__action">
                <span className="admin-action-label">Langkah berikutnya</span>
                <strong>{item.suggestedAction}</strong>
                <Link href={`#${item.targetSection}`}>
                  Buka bagian terkait
                  <span className="ui-visually-hidden">
                    {" "}
                    untuk {item.reference}
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export { SeverityLabel };
