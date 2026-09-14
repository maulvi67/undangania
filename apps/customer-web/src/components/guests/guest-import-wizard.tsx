"use client";

import Link from "next/link";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, StatePanel } from "@wedding/ui";
import {
  parseGuestCsv,

  type GuestFixture,
  type GuestImportPreview,
  type GuestManagementData,
  type GuestImportRow,
} from "../../lib/guests/contract";

const CSV_TEMPLATE = [
  "nama_rumah_tangga,nama_tamu,telepon,email,maksimal_pax,akses_acara,tag",
  "Keluarga Budi Santoso,Budi Santoso,,budi@example.id,4,Akad Nikah|Resepsi,Keluarga besar",
].join("\n");

function fixtureCsv(fixture: GuestFixture): string {
  if (fixture === "invalid-csv") return "nama_rumah_tangga,telepon\nKeluarga Tidak Lengkap,+628123456789";
  if (fixture === "potential-duplicate") return [
    "nama_rumah_tangga,nama_tamu,telepon,email,maksimal_pax,akses_acara,tag",
    "Keluarga Budi Santoso,Budi Santoso,,budi@example.id,4,Akad Nikah|Resepsi,Keluarga besar",
    "Keluarga Baru,Maya Baru,,maya@example.id,2,Resepsi,Teman",
  ].join("\n");
  if (fixture === "partial-import") return [
    "nama_rumah_tangga,nama_tamu,telepon,email,maksimal_pax,akses_acara,tag",
    "Keluarga Baru,Maya Baru,,maya@example.id,2,Resepsi,Teman",
    "Baris Tidak Valid,,,+bukan-email,0,Acara Tidak Ada,",
  ].join("\n");
  return CSV_TEMPLATE;
}

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

export function GuestImportWizard({
  management,
  fixture,
}: {
  management: GuestManagementData;
  fixture: GuestFixture;
}) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<GuestImportPreview | null>(null);
  const [processing, setProcessing] = useState(fixture === "import-processing");
  const [confirmed, setConfirmed] = useState(false);
  const [selectedDuplicateRows, setSelectedDuplicateRows] = useState<ReadonlySet<number>>(new Set());
  const events = management.events;
  const hasPreview = preview !== null;

  const readFile = (file: File) => {
    setFileName(file.name);
    setProcessing(true);
    setConfirmed(false);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      window.setTimeout(() => {
        setPreview(parseGuestCsv(value, events, management.households));
        setProcessing(false);
      }, 220);
    });
    reader.readAsText(file);
  };

  useEffect(() => {
    if (!processing || fixture !== "import-processing") return;
    const timer = window.setTimeout(() => {
      setPreview(parseGuestCsv(fixtureCsv("potential-duplicate"), events, management.households));
      setProcessing(false);
      setFileName("daftar-tamu.csv");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [events, fixture, management.households, processing]);

  const loadFixture = () => {
    setFileName("contoh-tamu.csv");
    setProcessing(true);
    setConfirmed(false);
    window.setTimeout(() => {
      setPreview(parseGuestCsv(fixtureCsv(fixture), events, management.households));
      setProcessing(false);
    }, 220);
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

  return (
    <div className="gst-import">
      <header className="gst-page__header">
        <div>
          <Link className="gst-backlink" href={`/tamu${fixture === "normal" ? "" : `?fixture=${fixture}`}`}>
            ← Kembali ke daftar tamu
          </Link>
          <p className="gst-eyebrow">Impor daftar tamu</p>
          <h1>Impor dari CSV</h1>
          <p className="gst-page__lead">Unggah file, tinjau setiap baris, lalu konfirmasi sebelum rumah tangga dibuat.</p>
        </div>
      </header>

      <ol className="gst-import__steps" aria-label="Langkah impor CSV">
        <li className={!hasPreview ? "gst-import__step--current" : ""}><span>1</span> Unggah</li>
        <li className={hasPreview && !confirmed ? "gst-import__step--current" : ""}><span>2</span> Tinjau</li>
        <li className={confirmed ? "gst-import__step--current" : ""}><span>3</span> Selesai</li>
      </ol>

      {!hasPreview && !confirmed ? (
        <section className="gst-import__upload" aria-labelledby="gst-upload-title">
          <p className="gst-eyebrow">Langkah 1</p>
          <h2 id="gst-upload-title">Unggah file CSV</h2>
          <p>Gunakan satu baris untuk setiap tamu. Nama rumah tangga yang sama akan dikelompokkan menjadi satu rumah tangga.</p>
          <div className="gst-import__requirements">
            <strong>Kolom yang tersedia</strong>
            <code>nama_rumah_tangga, nama_tamu, telepon, email, maksimal_pax, akses_acara, tag</code>
            <span>Kontak bersifat opsional. Data tidak akan dibuat sebelum Anda mengonfirmasi hasil tinjauan.</span>
          </div>
          <div className="gst-import__upload-actions">
            <label className="ui-button ui-button--primary ui-button--md gst-file-label" htmlFor="gst-csv-file">Pilih file CSV</label>
            <input id="gst-csv-file" className="gst-file-input" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); }} />
            <Button type="button" variant="secondary" onClick={downloadTemplate}>Unduh template CSV</Button>
            {fixture !== "normal" ? <Button type="button" variant="tertiary" onClick={loadFixture}>Muat fixture pengujian</Button> : null}
          </div>
          {fileName ? <p className="gst-import__filename">File dipilih: {fileName}</p> : null}
          {processing ? <div className="gst-import__processing" role="status" aria-live="polite">Sedang memproses file CSV…</div> : null}
        </section>
      ) : null}

      {processing ? (
        <div className="gst-import__processing gst-import__processing--panel" role="status" aria-live="polite">
          <span className="gst-import__spinner" aria-hidden="true" />
          <span>File CSV sedang diperiksa. Jangan tutup halaman ini.</span>
        </div>
      ) : null}

      {preview && !confirmed ? (
        <section className="gst-import__review" aria-labelledby="gst-review-title">
          <div className="gst-import__review-header">
            <div>
              <p className="gst-eyebrow">Langkah 2</p>
              <h2 id="gst-review-title">Tinjau hasil impor</h2>
              <p>{preview.rows.length} baris ditemukan. Tidak ada data yang akan dibuat sebelum Anda mengonfirmasi.</p>
            </div>
            <div className="gst-import__counts" aria-label="Ringkasan hasil impor">
              <span><strong>{preview.validCount}</strong> siap</span>
              <span><strong>{preview.invalidCount}</strong> perlu diperbaiki</span>
              <span><strong>{preview.duplicateCount}</strong> duplikat potensial</span>
            </div>
          </div>
          {!preview.headersValid ? <div className="gst-import__error"><Alert variant="error" title="Format CSV tidak valid"><ul>{preview.headerIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></Alert></div> : null}
          {preview.rows.length > 0 ? (
            <>
              <div className="gst-import__table-wrap">
                <table className="gst-import__table">
                  <caption className="ui-visually-hidden">Baris CSV yang akan ditinjau</caption>
                  <thead><tr><th scope="col">Baris</th><th scope="col">Rumah tangga</th><th scope="col">Tamu</th><th scope="col">Pax</th><th scope="col">Status</th><th scope="col">Catatan</th></tr></thead>
                  <tbody>{preview.rows.map((row) => <ImportRow key={row.rowNumber} row={row} selected={selectedDuplicateRows.has(row.rowNumber)} onDuplicateChange={(selected) => toggleDuplicate(row.rowNumber, selected)} />)}</tbody>
                </table>
              </div>
              <div className="gst-import__cards">{preview.rows.map((row) => <ImportCard key={row.rowNumber} row={row} selected={selectedDuplicateRows.has(row.rowNumber)} onDuplicateChange={(selected) => toggleDuplicate(row.rowNumber, selected)} />)}</div>
              <div className="gst-import__review-actions">
                <Link className="ui-button ui-button--secondary ui-button--md" href={`/tamu${fixture === "normal" ? "" : `?fixture=${fixture}`}`}>Batalkan</Link>
                <Button type="button" disabled={acceptedCount === 0} onClick={() => setConfirmed(true)}>Konfirmasi impor ({acceptedCount})</Button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {confirmed ? (
        <section className="gst-import__complete" aria-labelledby="gst-import-complete-title">
          <StatePanel title="Impor siap diproses" description={`${acceptedCount} baris akan dimasukkan melalui layanan tenant-scoped pada versi produksi. Baris yang tidak dipilih tetap tidak akan dibuat.`} action={<Link className="ui-button ui-button--primary ui-button--md" href="/tamu">Kembali ke daftar tamu</Link>} />
        </section>
      ) : null}
    </div>
  );
}

function ImportRow({ row, selected, onDuplicateChange }: { row: GuestImportRow; selected: boolean; onDuplicateChange: (selected: boolean) => void }) {
  return (
    <tr className={`gst-import__row gst-import__row--${row.status}`}>
      <td>{row.rowNumber}</td>
      <th scope="row">{row.householdName || "—"}</th>
      <td>{row.guestName || "—"}</td>
      <td>{row.maximumPax ?? "—"}</td>
      <td><Badge tone={rowTone(row.status)}>{rowLabel(row.status)}</Badge></td>
      <td><ImportRowNote row={row} selected={selected} onDuplicateChange={onDuplicateChange} /></td>
    </tr>
  );
}

function ImportCard({ row, selected, onDuplicateChange }: { row: GuestImportRow; selected: boolean; onDuplicateChange: (selected: boolean) => void }) {
  return (
    <article className={`gst-import__card gst-import__row--${row.status}`}>
      <div className="gst-import__card-header"><span>Baris {row.rowNumber}</span><Badge tone={rowTone(row.status)}>{rowLabel(row.status)}</Badge></div>
      <h3>{row.householdName || "Nama rumah tangga belum diisi"}</h3>
      <p>{row.guestName || "Nama tamu belum diisi"} · {row.maximumPax ?? "Pax belum valid"}</p>
      <ImportRowNote row={row} selected={selected} onDuplicateChange={onDuplicateChange} />
    </article>
  );
}

function ImportRowNote({ row, selected, onDuplicateChange }: { row: GuestImportRow; selected: boolean; onDuplicateChange: (selected: boolean) => void }) {
  if (row.status === "invalid") return <ul className="gst-import__issues">{row.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>;
  if (row.status === "duplicate") return (
    <div className="gst-import__duplicate">
      <p>Mungkin cocok dengan “{row.duplicateWith}”. Tidak ada data yang digabung otomatis.</p>
      <label><input type="checkbox" checked={selected} onChange={(event) => onDuplicateChange(event.target.checked)} /> Impor sebagai rumah tangga baru</label>
    </div>
  );
  return <span className="gst-muted">Semua data dasar valid.</span>;
}
