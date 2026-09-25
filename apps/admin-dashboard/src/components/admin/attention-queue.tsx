import Link from "next/link";
import type { AdminDashboard } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader } from "../ui/card";
import { SectionState } from "./section-state";

function SeverityLabel({ severity }: { severity: string }) {
  const labels: Record<string, string> = { critical: "Kritis", high: "Tinggi", warning: "Perhatian", info: "Info", healthy: "Sehat" };
  return <span className={`admin-severity admin-severity--${severity}`}><span className="admin-severity__dot" aria-hidden="true" />{labels[severity] ?? severity}</span>;
}

const SECTION_ANCHORS: Record<string, string> = {
  payments: "pembayaran",
  "publication-failures": "publikasi",
  "failed-jobs": "pekerjaan-gagal",
};

export function AttentionQueue({ section }: { section: AdminDashboard["attention"] }) {
  return (
    <Card className="admin-section border-t-4 border-t-[var(--color-accent)]" id="ringkasan" aria-labelledby="attention-title">
      <CardHeader className="admin-section__heading"><div><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--color-accent-strong)]">Prioritas pertama</p><h2 id="attention-title" className="mt-1 text-xl font-bold">Perlu perhatian</h2><p className="mt-2 max-w-3xl text-sm text-[var(--color-ink-soft)]">Mulai dari isu dengan dampak dan urgensi tertinggi. Setiap item memiliki pemilik dan langkah aman berikutnya.</p></div>{section.status === "ok" ? <Badge>{section.rows.length} item simulasi</Badge> : null}</CardHeader>
      {section.status !== "ok" ? <CardContent><SectionState status={section.status} message={section.message} /></CardContent> : section.rows.length === 0 ? <CardContent><SectionState status="ok" emptyTitle="Tidak ada isu mendesak" emptyDescription="Antrean operasional saat ini tidak memiliki item yang perlu ditindaklanjuti." /></CardContent> : <CardContent className="admin-attention-list grid gap-3">{section.rows.map((item) => <article className={`admin-attention-item grid gap-4 border border-[var(--color-line)] border-l-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(13rem,1fr)_minmax(14rem,1fr)] ${item.severity === "critical" ? "border-l-[var(--color-danger)] bg-[#fff1ec]" : item.severity === "high" ? "border-l-[#9a5a3f] bg-[#fff7f1]" : "border-l-[#c99b2d] bg-[#fffced]"}`} key={item.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><SeverityLabel severity={item.severity} /><span className="font-mono text-xs text-[var(--color-ink-soft)]">{item.reference}</span></div><h3 className="mt-3 text-base font-bold">{item.issue}</h3><p className="mt-2 text-sm text-[var(--color-ink-soft)]">{item.summary}</p></div><dl className="grid content-start gap-2 text-sm">{[["Status", item.status], ["Usia", item.age], ["Pemilik", item.owner], ["Diperbarui", `${formatAdminTimestamp(item.updatedAt)} WIB`]].map(([label, value]) => <div className="grid grid-cols-[minmax(4rem,.65fr)_minmax(0,1.35fr)] gap-3 border-b border-[var(--color-line)] pb-2" key={label}><dt className="text-[var(--color-ink-soft)]">{label}</dt><dd className="m-0 break-words text-right">{value}</dd></div>)}</dl><div className="grid content-start gap-2 border-t border-[var(--color-line)] pt-4 text-sm xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"><span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--color-ink-soft)]">Langkah berikutnya</span><strong>{item.suggestedAction}</strong><Link className="font-bold text-[var(--color-accent-strong)] underline underline-offset-4" href={`#${SECTION_ANCHORS[item.targetSection] ?? item.targetSection}`}>Buka bagian terkait<span className="ui-visually-hidden"> untuk {item.reference}</span></Link></div></article>)}</CardContent>}
    </Card>
  );
}

export { SeverityLabel };
