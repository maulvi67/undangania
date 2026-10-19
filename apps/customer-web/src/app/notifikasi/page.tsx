import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationShell, Badge, StatePanel } from "@wedding/ui";
import { loadNotificationStatus } from "../../lib/notifications/status";
import "../guests.css";

export const metadata: Metadata = {
  title: "Notifikasi — Undangania",
  description: "Status pengiriman email transaksional workspace Anda.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu" },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
  { href: "/notifikasi", label: "Notifikasi", current: true },
] as const;

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Menunggu dikirim",
  SENT: "Terkirim",
  DELIVERED: "Diterima",
  FAILED: "Gagal",
  SUPPRESSED: "Ditahan",
};

const STATUS_TONES: Record<string, "olive" | "gold" | "blush" | "neutral"> = {
  QUEUED: "gold",
  SENT: "olive",
  DELIVERED: "olive",
  FAILED: "blush",
  SUPPRESSED: "neutral",
};

const TEMPLATE_LABELS: Record<string, string> = {
  "auth.email-verification": "Verifikasi email",
  "auth.password-reset": "Reset kata sandi",
  "auth.password-changed": "Kata sandi diubah",
  "payment.payment-confirmed": "Pembayaran dikonfirmasi",
};

function formatDate(value: Date | null): string {
  if (value === null) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

export default async function NotificationsPage() {
  const result = await loadNotificationStatus();

  return (
    <ApplicationShell
      nav={NAV}
      footerNote="Status pengiriman berasal dari penyedia email, bukan dari klien."
    >
      {result.kind === "ok" ? (
        <div className="gst-page">
          <header className="gst-page__header">
            <div>
              <p className="gst-eyebrow">Email transaksional</p>
              <h1>Notifikasi</h1>
              <p className="gst-page__lead">
                Status pengiriman pesan penting workspace ini. Alamat penerima
                tidak ditampilkan pada halaman ini.
              </p>
            </div>
          </header>

          {result.rows.length === 0 ? (
            <div className="gst-state">
              <StatePanel
                title="Belum ada notifikasi"
                description="Pesan verifikasi, reset kata sandi, dan konfirmasi pembayaran akan tercatat di sini setelah dikirim."
              />
            </div>
          ) : (
            <div className="gst-import__table-wrap">
              <table className="gst-import__table">
                <caption className="ui-visually-hidden">
                  Status pengiriman notifikasi workspace
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Jenis pesan</th>
                    <th scope="col">Kanal</th>
                    <th scope="col">Status</th>
                    <th scope="col">Percobaan</th>
                    <th scope="col">Dibuat</th>
                    <th scope="col">Diterima</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">
                        {TEMPLATE_LABELS[row.templateCode] ?? row.templateCode}
                      </th>
                      <td>{row.channel === "EMAIL" ? "Email" : row.channel}</td>
                      <td>
                        <Badge tone={STATUS_TONES[row.status] ?? "neutral"}>
                          {STATUS_LABELS[row.status] ?? "Tidak diketahui"}
                        </Badge>
                      </td>
                      <td>{row.attemptCount}</td>
                      <td>{formatDate(row.createdAt)}</td>
                      <td>{formatDate(row.deliveredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="gst-muted">
            Notifikasi yang gagal akan dicoba ulang oleh layanan pengiriman.
            Hubungi dukungan bila status tetap gagal.
          </p>
        </div>
      ) : null}

      {result.kind === "unauthenticated" ? (
        <div className="gst-state">
          <StatePanel
            title="Masuk untuk melihat notifikasi"
            description="Masuk ke akun Undangania untuk melihat status pengiriman email workspace Anda."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/masuk?next=%2Fnotifikasi"
              >
                Masuk
              </Link>
            }
          />
        </div>
      ) : null}

      {result.kind === "unavailable" ? (
        <div className="gst-state">
          <StatePanel
            title="Notifikasi belum dapat dimuat"
            description="Layanan notifikasi sedang tidak tersedia. Coba muat ulang halaman ini."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/notifikasi"
              >
                Coba lagi
              </Link>
            }
          />
        </div>
      ) : null}
    </ApplicationShell>
  );
}
