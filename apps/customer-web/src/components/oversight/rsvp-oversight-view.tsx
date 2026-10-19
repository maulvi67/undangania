"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, StatePanel } from "@wedding/ui";
import type { RsvpOverview } from "../../lib/oversight/server";
import {
  exportRsvpAction,
  overrideRsvpAction,
} from "../../lib/oversight/actions";

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
  const [rows, setRows] = useState(data.rows);
  const [editing, setEditing] = useState<{
    id: string;
    response: string;
    pax: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (eventFilter === "" || row.eventId === eventFilter) &&
          (responseFilter === "" || row.response === responseFilter),
      ),
    [eventFilter, responseFilter, rows],
  );

  const hasAnswers = rows.length > 0;

  const save = async () => {
    if (editing === null || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const outcome = await overrideRsvpAction({
        rsvpId: editing.id,
        response: editing.response,
        pax: editing.pax,
      });
      if (outcome.kind !== "ok") {
        setIsError(true);
        setNotice(
          outcome.kind === "forbidden"
            ? "Anda tidak memiliki izin untuk mengubah jawaban ini."
            : outcome.kind === "not-found"
              ? "Jawaban ini tidak ditemukan di workspace Anda."
              : outcome.kind === "invalid"
                ? outcome.message
                : "Jawaban belum dapat disimpan. Coba lagi.",
        );
        return;
      }
      setRows((current) =>
        current.map((row) =>
          row.id === editing.id
            ? {
                ...row,
                response: editing.response as typeof row.response,
                pax: editing.response === "DECLINED" ? 0 : editing.pax,
              }
            : row,
        ),
      );
      setIsError(false);
      setNotice("Jawaban tamu diperbarui dan riwayat perubahan tersimpan.");
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (exporting) return;
    setExporting(true);
    setNotice(null);
    try {
      const outcome = await exportRsvpAction();
      if (outcome.kind !== "ok") {
        setIsError(true);
        setNotice(
          outcome.kind === "forbidden"
            ? "Anda tidak memiliki izin untuk mengekspor jawaban."
            : "Ekspor belum dapat disiapkan. Coba lagi.",
        );
        return;
      }
      const blob = new Blob([outcome.csv], { type: outcome.contentType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = outcome.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setIsError(false);
      setNotice("Ekspor RSVP diunduh dan tercatat pada audit.");
    } finally {
      setExporting(false);
    }
  };

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
        <div className="gst-page__actions">
          <Button
            type="button"
            variant="secondary"
            loading={exporting}
            onClick={() => void download()}
          >
            Ekspor CSV
          </Button>
        </div>
      </header>

      {notice ? (
        <div className="gst-notice">
          <Alert variant={isError ? "warning" : "success"} title="RSVP">
            {notice}
          </Alert>
        </div>
      ) : null}

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
                  <th scope="col">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isEditing = editing?.id === row.id;
                  return (
                    <tr key={row.id}>
                      <th scope="row">{row.householdName}</th>
                      <td>{row.eventTitle}</td>
                      <td>
                        {isEditing ? (
                          <select
                            className="ui-field__input"
                            aria-label={`Jawaban ${row.householdName}`}
                            value={editing.response}
                            onChange={(event) => {
                              const response = event.currentTarget.value;
                              setEditing((current) =>
                                current === null
                                  ? null
                                  : {
                                      ...current,
                                      response,
                                      pax:
                                        response === "DECLINED"
                                          ? 0
                                          : current.pax,
                                    },
                              );
                            }}
                          >
                            <option value="ATTENDING">Hadir</option>
                            <option value="DECLINED">Tidak hadir</option>
                            <option value="TENTATIVE">Tentatif</option>
                          </select>
                        ) : (
                          <Badge
                            tone={RESPONSE_TONES[row.response] ?? "neutral"}
                          >
                            {RESPONSE_LABELS[row.response] ?? "Tentatif"}
                          </Badge>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="ui-field__input"
                            type="number"
                            min={0}
                            max={20}
                            aria-label={`Jumlah orang ${row.householdName}`}
                            value={
                              editing.response === "DECLINED" ? 0 : editing.pax
                            }
                            disabled={editing.response === "DECLINED"}
                            onChange={(event) =>
                              setEditing((current) =>
                                current === null
                                  ? null
                                  : {
                                      ...current,
                                      pax: Number(event.currentTarget.value),
                                    },
                              )
                            }
                          />
                        ) : row.response === "ATTENDING" ? (
                          row.pax
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{formatDate(row.respondedAt)}</td>
                      <td>
                        {isEditing ? (
                          <div className="gst-detail__actions">
                            <Button
                              type="button"
                              size="sm"
                              loading={saving}
                              onClick={() => void save()}
                            >
                              Simpan
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={saving}
                              onClick={() => setEditing(null)}
                            >
                              Batal
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setNotice(null);
                              setEditing({
                                id: row.id,
                                response: row.response,
                                pax: row.pax,
                              });
                            }}
                          >
                            Ubah
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="gst-muted">
        Perubahan atas nama tamu disimpan bersama riwayat jawaban sebelumnya dan
        tercatat pada audit workspace.
      </p>
    </div>
  );
}
