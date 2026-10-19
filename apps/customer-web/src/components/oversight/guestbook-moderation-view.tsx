"use client";

import { useState } from "react";
import { Alert, Badge, Button, StatePanel } from "@wedding/ui";
import type { GuestbookOverview } from "../../lib/oversight/server";
import { moderateGuestbookAction } from "../../lib/oversight/actions";

/**
 * Guestbook moderation.
 *
 * The couple is the moderator for their own invitation. A submitted greeting is
 * stored `PENDING` and is not shown to other guests until it is approved here — which
 * is why the pending queue is the first thing on the page rather than a filter.
 *
 * The message body is rendered as text, never as markup: a guest's greeting is
 * untrusted input, and React's default escaping is the XSS boundary that
 * `docs/domains/guestbook.md` requires.
 */

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu tinjauan",
  APPROVED: "Ditampilkan",
  REJECTED: "Ditolak",
  HIDDEN: "Disembunyikan",
  DELETED: "Dihapus",
};

const STATUS_TONES: Record<string, "olive" | "blush" | "gold" | "neutral"> = {
  PENDING: "gold",
  APPROVED: "olive",
  REJECTED: "blush",
  HIDDEN: "neutral",
  DELETED: "blush",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

export function GuestbookModerationView({
  data,
  canModerate,
}: {
  data: GuestbookOverview;
  /** False for a viewer, who may read the queue but not decide it. */
  canModerate: boolean;
}) {
  const [status, setStatus] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.rows.map((row) => [row.id, row.moderationStatus])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const decide = async (messageId: string, decision: string) => {
    setPendingId(messageId);
    setNotice(null);
    try {
      const outcome = await moderateGuestbookAction(messageId, decision);
      if (outcome.kind !== "ok") {
        setIsError(true);
        setNotice(
          outcome.kind === "forbidden"
            ? "Anda tidak memiliki izin untuk meninjau ucapan di workspace ini."
            : outcome.kind === "not-found"
              ? "Ucapan ini tidak ditemukan di workspace Anda."
              : "Keputusan belum dapat disimpan. Silakan coba lagi.",
        );
        return;
      }
      setStatus((current) => ({ ...current, [messageId]: decision }));
      setIsError(false);
      setNotice(
        decision === "APPROVED"
          ? "Ucapan ditampilkan pada undangan."
          : decision === "REJECTED"
            ? "Ucapan ditolak dan tidak ditampilkan."
            : decision === "DELETED"
              ? "Ucapan dihapus dari undangan."
              : "Ucapan disembunyikan.",
      );
    } finally {
      setPendingId(null);
    }
  };

  const pending = data.rows.filter(
    (row) => (status[row.id] ?? row.moderationStatus) === "PENDING",
  );

  return (
    <div className="gst-page">
      <header className="gst-page__header">
        <div>
          <p className="gst-eyebrow">Doa dan ucapan</p>
          <h1>Buku tamu</h1>
          <p className="gst-page__lead">
            Ucapan yang dikirim tamu melalui undangan Anda. Ucapan baru tidak
            ditampilkan sebelum Anda setujui.
          </p>
        </div>
      </header>

      <section className="gst-summary" aria-label="Ringkasan buku tamu">
        <div>
          <strong>{pending.length}</strong>
          <span>menunggu tinjauan</span>
        </div>
        <div>
          <strong>{data.rows.length}</strong>
          <span>total ucapan</span>
        </div>
        <div>
          <strong>{data.pendingCount}</strong>
          <span>belum ditinjau saat halaman dimuat</span>
        </div>
      </section>

      {notice ? (
        <div className="gst-notice">
          <Alert
            variant={isError ? "warning" : "success"}
            title="Status tinjauan"
          >
            {notice}
          </Alert>
        </div>
      ) : null}

      {!canModerate ? (
        <div className="gst-notice">
          <Alert variant="info" title="Hanya dapat melihat">
            Anda dapat membaca daftar ucapan, tetapi tidak memiliki izin untuk
            menyetujui atau menolaknya.
          </Alert>
        </div>
      ) : null}

      {data.rows.length === 0 ? (
        <div className="gst-state">
          <StatePanel
            title="Belum ada ucapan"
            description="Ucapan dari tamu akan muncul di sini untuk Anda tinjau sebelum ditampilkan pada undangan."
          />
        </div>
      ) : (
        <ul className="gst-member-list">
          {data.rows.map((row) => {
            const current = status[row.id] ?? row.moderationStatus;
            return (
              <li key={row.id} className="gst-detail__section">
                <div className="gst-detail__section-head">
                  <div>
                    <p className="gst-eyebrow">{formatDate(row.submittedAt)}</p>
                    <h2>{row.displayName}</h2>
                  </div>
                  <Badge tone={STATUS_TONES[current] ?? "neutral"}>
                    {STATUS_LABELS[current] ?? "Menunggu tinjauan"}
                  </Badge>
                </div>
                {/* Rendered as text: React escapes it, which is the XSS boundary. */}
                <p className="gst-detail__copy">{row.message}</p>
                {canModerate ? (
                  <div className="gst-detail__actions">
                    <Button
                      type="button"
                      disabled={pendingId === row.id || current === "APPROVED"}
                      onClick={() => void decide(row.id, "APPROVED")}
                    >
                      Tampilkan
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pendingId === row.id || current === "REJECTED"}
                      onClick={() => void decide(row.id, "REJECTED")}
                    >
                      Tolak
                    </Button>
                    <Button
                      type="button"
                      variant="tertiary"
                      disabled={pendingId === row.id || current === "HIDDEN"}
                      onClick={() => void decide(row.id, "HIDDEN")}
                    >
                      Sembunyikan
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={pendingId === row.id || current === "DELETED"}
                      onClick={() => void decide(row.id, "DELETED")}
                    >
                      Hapus
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
