"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, StatePanel } from "@wedding/ui";
import type { RsvpOverview } from "../../lib/oversight/server";

/**
 * RSVP oversight.
 *
 * Read-only by design. Editing an answer on a guest's behalf is an override, which
 * the RSVP domain reserves for the couple or an admin and which would need the same
 * history and audit trail a guest submission writes — neither of which exists on this
 * path yet. Showing the answers without offering a silent edit is the honest state.
 */

const RESPONSE_LABELS: Record<string, string> = {
  ATTENDING: "Hadir",
  DECLINED: "Tidak hadir",
  TENTATIVE: "Tentatif",
};

const RESPONSE_TONES: Record<string, "olive" | "blush" | "gold"> = {
  ATTENDING: "olive",
  DECLINED: "blush",
  TENTATIVE: "gold",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

export function RsvpOversightView({ data }: { data: RsvpOverview }) {
  const [eventFilter, setEventFilter] = useState("");
  const [responseFilter, setResponseFilter] = useState("");

  const filtered = useMemo(
    () =>
      data.rows.filter(
        (row) =>
          (eventFilter === "" || row.eventId === eventFilter) &&
          (responseFilter === "" || row.response === responseFilter),
      ),
    [data.rows, eventFilter, responseFilter],
  );

  const hasAnswers = data.rows.length > 0;

  return (
    <div className="gst-page">
      <header className="gst-page__header">
        <div>
          <p className="gst-eyebrow">Konfirmasi kehadiran</p>
          <h1>RSVP</h1>
          <p className="gst-page__lead">
            Jawaban yang dikirim tamu melalui tautan personal mereka. Angka ini
            diperbarui saat tamu menyimpan jawabannya.
          </p>
        </div>
      </header>

      <section className="gst-summary" aria-label="Ringkasan konfirmasi">
        <div>
          <strong>{data.invitedGuests}</strong>
          <span>tamu diundang</span>
        </div>
        <div>
          <strong>{data.answeredHouseholds}</strong>
          <span>dari {data.invitedHouseholds} rumah tangga menjawab</span>
        </div>
        <div>
          <strong>{data.totals.attendingPax}</strong>
          <span>orang dikonfirmasi hadir</span>
        </div>
      </section>

      <section className="gst-summary" aria-label="Rincian jawaban">
        <div>
          <strong>{data.totals.attending}</strong>
          <span>jawaban hadir</span>
        </div>
        <div>
          <strong>{data.totals.declined}</strong>
          <span>jawaban tidak hadir</span>
        </div>
        <div>
          <strong>{data.totals.tentative}</strong>
          <span>jawaban tentatif</span>
        </div>
      </section>

      {!hasAnswers ? (
        <div className="gst-state">
          <StatePanel
            title="Belum ada jawaban"
            description="Bagikan tautan personal dari halaman tamu agar tamu Anda dapat mengonfirmasi kehadiran."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/tamu"
              >
                Kelola tamu
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="gst-controls" aria-labelledby="gst-rsvp-filter">
            <h2 id="gst-rsvp-filter" className="ui-visually-hidden">
              Saring jawaban
            </h2>
            <label className="ui-field">
              <span className="ui-field__label">Acara</span>
              <select
                className="ui-field__input"
                value={eventFilter}
                onChange={(event) => setEventFilter(event.target.value)}
              >
                <option value="">Semua acara</option>
                {data.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Jawaban</span>
              <select
                className="ui-field__input"
                value={responseFilter}
                onChange={(event) => setResponseFilter(event.target.value)}
              >
                <option value="">Semua jawaban</option>
                <option value="ATTENDING">Hadir</option>
                <option value="DECLINED">Tidak hadir</option>
                <option value="TENTATIVE">Tentatif</option>
              </select>
            </label>
          </section>

          <p className="gst-muted" role="status">
            {filtered.length} jawaban ditampilkan.
          </p>

          <div className="gst-import__table-wrap">
            <table className="gst-import__table">
              <caption className="ui-visually-hidden">
                Jawaban konfirmasi kehadiran per rumah tangga dan acara
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rumah tangga</th>
                  <th scope="col">Acara</th>
                  <th scope="col">Jawaban</th>
                  <th scope="col">Jumlah orang</th>
                  <th scope="col">Waktu jawab</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.householdName}</th>
                    <td>{row.eventTitle}</td>
                    <td>
                      <Badge tone={RESPONSE_TONES[row.response] ?? "neutral"}>
                        {RESPONSE_LABELS[row.response] ?? "Tentatif"}
                      </Badge>
                    </td>
                    <td>{row.response === "ATTENDING" ? row.pax : "—"}</td>
                    <td>{formatDate(row.respondedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="gst-muted">
        Untuk mengubah jawaban atas nama tamu, minta tamu membuka tautan
        personalnya kembali. Perubahan melalui halaman ini belum tersedia karena
        belum memiliki riwayat perubahan yang sama dengan jawaban tamu.
      </p>
    </div>
  );
}
