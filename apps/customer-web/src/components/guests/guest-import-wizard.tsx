"use client";

import Link from "next/link";
import * as React from "react";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, StatePanel } from "@wedding/ui";
import {
  parseGuestCsv,
  type GuestEvent,
  type GuestHouseholdListItem,
  type GuestImportPreview,
  type GuestImportRow,
} from "../../lib/guests/contract";
import { importGuestHouseholdsAction } from "../../lib/guests/actions";
import type { GuestImportOutcome } from "../../lib/guests/outcomes";

const CSV_TEMPLATE = [
  "nama_rumah_tangga,nama_tamu,telepon,email,maksimal_pax,akses_acara,tag",
  "Keluarga Budi Santoso,Budi Santoso,,budi@example.id,4,Akad Nikah|Resepsi,Keluarga besar",
].join("\n");

function rowTone(status: GuestImportRow["status"]): "olive" | "gold" | "blush" {
  if (status === "valid") return "olive";
  if (status === "duplicate") return "gold";
  return "blush";
}

function rowLabel(status: GuestImportRow["status"]): string {
  if (status === "valid") return "Siap diimpor";
  if (status === "duplicate") return "Duplikat potensial";
  return "Perlu diperbaiki";
}

/**
 * Groups the reviewed rows into one entry per household.
 *
 * The CSV repeats the household name on every row, so the same name across several
 * rows is one household with several members — not several households. Grouping by
 * the normalized name is what keeps `Keluarga Budi Santoso` from being created three
 * times.
 */
function toImportRows(
  preview: GuestImportPreview,
  acceptedDuplicates: ReadonlySet<number>,
): readonly {
  householdName: string;
  memberNames: readonly string[];
  maximumPax: number;
  eventNames: readonly string[];
  tag: string;
}[] {
  const byName = new Map<
    string,
    {
      householdName: string;
      memberNames: string[];
      maximumPax: number;
      eventNames: Set<string>;
      tag: string;
    }
  >();
  for (const row of preview.rows) {
    const accepted =
      row.status === "valid" ||
      (row.status === "duplicate" && acceptedDuplicates.has(row.rowNumber));
    if (!accepted) continue;

    const key = row.householdName.trim().toLocaleLowerCase("id-ID");
    const existing = byName.get(key);
    if (existing === undefined) {
      byName.set(key, {
        householdName: row.householdName.trim(),
        memberNames: [row.guestName.trim()],
        maximumPax: row.maximumPax ?? 1,
        eventNames: new Set(row.eventNames),
        tag: row.tag.trim(),
      });
      continue;
    }
    existing.memberNames.push(row.guestName.trim());
    for (const eventName of row.eventNames) existing.eventNames.add(eventName);
    if (existing.tag === "" && row.tag.trim() !== "")
      existing.tag = row.tag.trim();
    // The largest figure wins: a household is imported once, and taking the smaller
    // of two stated allowances would silently drop someone the couple listed.
    existing.maximumPax = Math.max(existing.maximumPax, row.maximumPax ?? 1);
  }
  return [...byName.values()].map((entry) => ({
    householdName: entry.householdName,
    memberNames: entry.memberNames,
    // The allowance can never be smaller than the members actually named, which is
    // a rule the form enforces too.
    maximumPax: Math.max(entry.maximumPax, entry.memberNames.length),
    eventNames: [...entry.eventNames],
    tag: entry.tag,
  }));
}

export function GuestImportWizard({
  events,
  existingHouseholds,
}: {
  events: readonly GuestEvent[];
  existingHouseholds: readonly GuestHouseholdListItem[];
}) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<GuestImportPreview | null>(null);
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<GuestImportOutcome | null>(null);
  const [selectedDuplicateRows, setSelectedDuplicateRows] = useState<
    ReadonlySet<number>
  >(new Set());
  const hasPreview = preview !== null;

  const readFile = (file: File) => {
    setFileName(file.name);
    setProcessing(true);
    setConfirmed(false);
    setOutcome(null);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      window.setTimeout(() => {
        setPreview(parseGuestCsv(value, events, existingHouseholds));
        setProcessing(false);
      }, 220);
    });
    reader.readAsText(file);
  };

  const acceptedCount = useMemo(() => {
    if (!preview) return 0;
    return preview.validCount + selectedDuplicateRows.size;
  }, [preview, selectedDuplicateRows.size]);

  const toggleDuplicate = (rowNumber: number, selected: boolean) => {
    setSelectedDuplicateRows((current) => {
      const next = new Set(current);
      if (selected) next.add(rowNumber);
      else next.delete(rowNumber);
      return next;
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-tamu-wedding-system.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const commit = async () => {
    if (preview === null) return;
    const rows = toImportRows(preview, selectedDuplicateRows);
    if (rows.length === 0) return;

    // The step advances before the write, so the panel's own pending and outcome
    // states are what the customer watches rather than a stale review table.
    setConfirmed(true);
    setPending(true);
    setOutcome(null);
    try {
      setOutcome(await importGuestHouseholdsAction(rows));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="gst-import">
      <header className="gst-page__header">
        <div>
          <Link className="gst-backlink" href="/tamu">
            ← Kembali ke daftar tamu
          </Link>
          <p className="gst-eyebrow">Impor daftar tamu</p>
          <h1>Impor dari CSV</h1>
          <p className="gst-page__lead">
            Unggah file, tinjau setiap baris, lalu konfirmasi sebelum rumah
            tangga dibuat.
          </p>
        </div>
      </header>

      <ol className="gst-import__steps" aria-label="Langkah impor CSV">
        <li className={!hasPreview ? "gst-import__step--current" : ""}>
          <span>1</span> Unggah
        </li>
        <li
          className={
            hasPreview && !confirmed ? "gst-import__step--current" : ""
          }
        >
          <span>2</span> Tinjau
        </li>
        <li className={confirmed ? "gst-import__step--current" : ""}>
          <span>3</span> Selesai
        </li>
      </ol>

      {!hasPreview && !confirmed ? (
        <section
          className="gst-import__upload"
          aria-labelledby="gst-upload-title"
        >
          <p className="gst-eyebrow">Langkah 1</p>
          <h2 id="gst-upload-title">Unggah file CSV</h2>
          <p>
            Gunakan satu baris untuk setiap tamu. Nama rumah tangga yang sama
            akan dikelompokkan menjadi satu rumah tangga.
          </p>
          <div className="gst-import__requirements">
            <strong>Kolom yang tersedia</strong>
            <code>
              nama_rumah_tangga, nama_tamu, telepon, email, maksimal_pax,
              akses_acara, tag
            </code>
            <span>
              Kontak bersifat opsional. Data tidak akan dibuat sebelum Anda
              mengonfirmasi hasil tinjauan.
            </span>
          </div>
          <div className="gst-import__upload-actions">
            <label
              className="ui-button ui-button--primary ui-button--md gst-file-label"
              htmlFor="gst-csv-file"
            >
              Pilih file CSV
            </label>
            <input
              id="gst-csv-file"
              className="gst-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={downloadTemplate}
            >
              Unduh template CSV
            </Button>
          </div>
          {fileName ? (
            <p className="gst-import__filename">File dipilih: {fileName}</p>
          ) : null}
          {processing ? (
            <div
              className="gst-import__processing"
              role="status"
              aria-live="polite"
            >
              Sedang memproses file CSV…
            </div>
          ) : null}
        </section>
      ) : null}

      {processing ? (
        <div
          className="gst-import__processing gst-import__processing--panel"
          role="status"
          aria-live="polite"
        >
          <span className="gst-import__spinner" aria-hidden="true" />
          <span>File CSV sedang diperiksa. Jangan tutup halaman ini.</span>
        </div>
      ) : null}

      {preview && !confirmed ? (
        <section
          className="gst-import__review"
          aria-labelledby="gst-review-title"
        >
          <div className="gst-import__review-header">
            <div>
              <p className="gst-eyebrow">Langkah 2</p>
              <h2 id="gst-review-title">Tinjau hasil impor</h2>
              <p>
                {preview.rows.length} baris ditemukan. Tidak ada data yang akan
                dibuat sebelum Anda mengonfirmasi.
              </p>
            </div>
            <div
              className="gst-import__counts"
              aria-label="Ringkasan hasil impor"
            >
              <span>
                <strong>{preview.validCount}</strong> siap
              </span>
              <span>
                <strong>{preview.invalidCount}</strong> perlu diperbaiki
              </span>
              <span>
                <strong>{preview.duplicateCount}</strong> duplikat potensial
              </span>
            </div>
          </div>
          {!preview.headersValid ? (
            <div className="gst-import__error">
              <Alert variant="error" title="Format CSV tidak valid">
                <ul>
                  {preview.headerIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}
          {preview.rows.length > 0 ? (
            <>
              <div className="gst-import__table-wrap">
                <table className="gst-import__table">
                  <caption className="ui-visually-hidden">
                    Baris CSV yang akan ditinjau
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Baris</th>
                      <th scope="col">Rumah tangga</th>
                      <th scope="col">Tamu</th>
                      <th scope="col">Pax</th>
                      <th scope="col">Status</th>
                      <th scope="col">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <ImportRow
                        key={row.rowNumber}
                        row={row}
                        selected={selectedDuplicateRows.has(row.rowNumber)}
                        onDuplicateChange={(selected) =>
                          toggleDuplicate(row.rowNumber, selected)
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="gst-import__cards">
                {preview.rows.map((row) => (
                  <ImportCard
                    key={row.rowNumber}
                    row={row}
                    selected={selectedDuplicateRows.has(row.rowNumber)}
                    onDuplicateChange={(selected) =>
                      toggleDuplicate(row.rowNumber, selected)
                    }
                  />
                ))}
              </div>
              <div className="gst-import__review-actions">
                <Link
                  className="ui-button ui-button--secondary ui-button--md"
                  href="/tamu"
                >
                  Batalkan
                </Link>
                <Button
                  type="button"
                  loading={pending}
                  disabled={acceptedCount === 0 || pending}
                  onClick={() => void commit()}
                >
                  Konfirmasi impor ({acceptedCount})
                </Button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {confirmed ? (
        <section
          className="gst-import__complete"
          aria-labelledby="gst-import-complete-title"
        >
          {outcome === null ? (
            <StatePanel
              title={pending ? "Menjalankan impor" : "Impor belum diproses"}
              description={
                pending
                  ? "Jangan menutup halaman ini. Data tamu sedang disimpan."
                  : "Tinjau kembali baris yang dipilih, lalu jalankan impor."
              }
              action={
                <Button
                  type="button"
                  loading={pending}
                  disabled={pending}
                  onClick={() => void commit()}
                >
                  Jalankan impor
                </Button>
              }
            />
          ) : outcome.kind === "ok" ? (
            <StatePanel
              title="Impor selesai"
              description={`${outcome.createdHouseholds} rumah tangga dan ${outcome.createdGuests} tamu ditambahkan. Tautan personal untuk setiap rumah tangga dapat dibuat dari halaman detailnya.`}
              action={
                <Link
                  className="ui-button ui-button--primary ui-button--md"
                  href="/tamu"
                >
                  Kembali ke daftar tamu
                </Link>
              }
            />
          ) : (
            <StatePanel
              title="Impor belum berhasil"
              description={
                outcome.kind === "invalid"
                  ? (outcome.errors[0] ??
                    "Data impor perlu diperbaiki sebelum dijalankan.")
                  : outcome.kind === "forbidden"
                    ? "Anda tidak memiliki izin untuk menambah tamu di workspace ini."
                    : "Data belum dapat disimpan. Periksa koneksi Anda lalu coba lagi."
              }
              action={
                <Button
                  type="button"
                  loading={pending}
                  disabled={pending}
                  onClick={() => void commit()}
                >
                  Coba lagi
                </Button>
              }
            />
          )}
        </section>
      ) : null}
    </div>
  );
}

function ImportRow({
  row,
  selected,
  onDuplicateChange,
}: {
  row: GuestImportRow;
  selected: boolean;
  onDuplicateChange: (selected: boolean) => void;
}) {
  return (
    <tr className={`gst-import__row gst-import__row--${row.status}`}>
      <td>{row.rowNumber}</td>
      <th scope="row">{row.householdName || "—"}</th>
      <td>{row.guestName || "—"}</td>
      <td>{row.maximumPax ?? "—"}</td>
      <td>
        <Badge tone={rowTone(row.status)}>{rowLabel(row.status)}</Badge>
      </td>
      <td>
        <ImportRowNote
          row={row}
          selected={selected}
          onDuplicateChange={onDuplicateChange}
        />
      </td>
    </tr>
  );
}

function ImportCard({
  row,
  selected,
  onDuplicateChange,
}: {
  row: GuestImportRow;
  selected: boolean;
  onDuplicateChange: (selected: boolean) => void;
}) {
  return (
    <article className={`gst-import__card gst-import__row--${row.status}`}>
      <div className="gst-import__card-header">
        <span>Baris {row.rowNumber}</span>
        <Badge tone={rowTone(row.status)}>{rowLabel(row.status)}</Badge>
      </div>
      <h3>{row.householdName || "Nama rumah tangga belum diisi"}</h3>
      <p>
        {row.guestName || "Nama tamu belum diisi"} ·{" "}
        {row.maximumPax ?? "Pax belum valid"}
      </p>
      <ImportRowNote
        row={row}
        selected={selected}
        onDuplicateChange={onDuplicateChange}
      />
    </article>
  );
}

function ImportRowNote({
  row,
  selected,
  onDuplicateChange,
}: {
  row: GuestImportRow;
  selected: boolean;
  onDuplicateChange: (selected: boolean) => void;
}) {
  if (row.status === "invalid")
    return (
      <ul className="gst-import__issues">
        {row.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    );
  if (row.status === "duplicate")
    return (
      <div className="gst-import__duplicate">
        <p>
          Mungkin cocok dengan “{row.duplicateWith}”. Tidak ada data yang
          digabung otomatis.
        </p>
        <label>
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onDuplicateChange(event.target.checked)}
          />{" "}
          Impor sebagai rumah tangga baru
        </label>
      </div>
    );
  return <span className="gst-muted">Semua data dasar valid.</span>;
}
