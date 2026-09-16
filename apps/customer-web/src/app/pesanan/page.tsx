import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationShell, Badge, StatePanel } from "@wedding/ui";
import { loadOrderList } from "../../lib/checkout/orders";
import { formatIdrMinor } from "../../lib/checkout/contract";
import "../guests.css";

export const metadata: Metadata = {
  title: "Pesanan — Wedding System",
  description: "Riwayat pesanan dan status pembayaran workspace Anda.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu" },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
  { href: "/pesanan", label: "Pesanan", current: true },
] as const;

const STATE_LABELS: Record<string, string> = {
  VERIFYING: "Menunggu konfirmasi",
  PENDING: "Menunggu pembayaran",
  PAID: "Lunas",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
};

const STATE_TONES: Record<string, "olive" | "gold" | "blush" | "neutral"> = {
  PAID: "olive",
  PENDING: "gold",
  VERIFYING: "gold",
  FAILED: "blush",
  EXPIRED: "blush",
};

export default async function OrdersPage() {
  const result = await loadOrderList();

  return (
    <ApplicationShell
      nav={NAV}
      footerNote="Status lunas hanya muncul setelah konfirmasi server dari penyedia QRIS."
    >
      {result.kind === "ok" ? (
        <div className="gst-page">
          <header className="gst-page__header">
            <div>
              <p className="gst-eyebrow">Workspace pernikahan</p>
              <h1>Pesanan</h1>
              <p className="gst-page__lead">
                Riwayat pesanan workspace ini beserta status pembayarannya.
              </p>
            </div>
          </header>

          {result.orders.length === 0 ? (
            <div className="gst-state">
              <StatePanel
                title="Belum ada pesanan"
                description="Pesanan dibuat saat Anda melanjutkan pembayaran dari halaman checkout sebuah desain."
                action={
                  <Link
                    className="ui-button ui-button--primary ui-button--md"
                    href="/templates"
                  >
                    Lihat katalog desain
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="gst-import__table-wrap">
              <table className="gst-import__table">
                <caption className="ui-visually-hidden">
                  Riwayat pesanan workspace
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Nomor pesanan</th>
                    <th scope="col">Desain</th>
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                    <th scope="col">Status pembayaran</th>
                  </tr>
                </thead>
                <tbody>
                  {result.orders.map((order) => (
                    <tr key={order.orderNumber}>
                      <th scope="row">{order.orderNumber}</th>
                      <td>{order.productName}</td>
                      <td>{formatIdrMinor(order.totalMinor)}</td>
                      <td>
                        <Badge tone={STATE_TONES[order.current] ?? "neutral"}>
                          {STATE_LABELS[order.current] ?? "Menunggu konfirmasi"}
                        </Badge>
                      </td>
                      <td>
                        <Link
                          className="dash-section-link"
                          href={`/checkout/status?order=${encodeURIComponent(order.orderNumber)}`}
                        >
                          Periksa status
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="gst-muted">
            Kembali dari halaman penyedia pembayaran belum berarti pembayaran
            berhasil. Status di halaman ini berasal dari konfirmasi server
            penyedia QRIS.
          </p>
        </div>
      ) : null}
      {result.kind === "unauthenticated" ? (
        <div className="gst-state">
          <StatePanel
            title="Masuk untuk melihat pesanan"
            description="Masuk ke akun Wedding System untuk melihat riwayat pesanan workspace Anda."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/masuk?next=%2Fpesanan"
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
            title="Pesanan belum dapat dimuat"
            description="Layanan pesanan sedang tidak tersedia. Coba muat ulang halaman ini."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/pesanan"
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
