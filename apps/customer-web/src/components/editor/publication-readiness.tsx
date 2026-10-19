"use client";

import { Alert, Button } from "@wedding/ui";
import type {
  PublicationReadiness,
  EditorSectionId,
} from "../../lib/editor/contract";
import type {
  InvitationLifecycleOutcome,
  PublishOutcome,
} from "../../lib/editor/publish-action";

/**
 * Publication check, and the publish action it gates.
 *
 * The action is server-checked: this panel is an affordance, so the button being
 * present is a convenience rather than the control. A publish that the server
 * refuses for readiness reasons returns the authoritative issue list, which is
 * rendered here in place of the one computed on the client.
 */
export function PublicationReadiness({
  readiness,
  status,
  onSelect,
  onPublish,
  onSetActive,
  pending,
  lifecyclePending,
  lifecycleOutcome,
  outcome,
}: {
  readiness: PublicationReadiness;
  status: string;
  onSelect: (section: EditorSectionId) => void;
  onPublish: () => void;
  onSetActive: (active: boolean) => void;
  pending: boolean;
  lifecyclePending: boolean;
  lifecycleOutcome: InvitationLifecycleOutcome | null;
  outcome: PublishOutcome | null;
}) {
  const issues =
    outcome?.kind === "not-ready" ? outcome.readiness.issues : readiness.issues;
  const ready = outcome?.kind === "not-ready" ? false : readiness.ready;
  const published = status === "PUBLISHED";
  const paused = status === "PAUSED";
  const canPublish = ready && !published && !paused;
  const heading = paused
    ? "Undangan sedang dijeda"
    : published
      ? "Undangan sudah aktif"
      : ready
        ? "Siap diterbitkan"
        : "Masih ada yang perlu dilengkapi";

  return (
    <section
      className={`ed-readiness${ready ? " ed-readiness--ready" : ""}`}
      aria-labelledby="ed-readiness-title"
    >
      <div className="ed-readiness__heading">
        <div>
          <p className="ed-panel__eyebrow">Pemeriksaan publikasi</p>
          <h2 id="ed-readiness-title">{heading}</h2>
        </div>
        {ready ? null : (
          <span className="ed-readiness__count">{issues.length} hal</span>
        )}
      </div>

      {paused ? (
        <p>
          Undangan tidak dapat dibuka tamu selama dijeda. Data dan tautan
          personal tetap tersimpan; aktifkan kembali saat siap.
        </p>
      ) : published ? (
        <p>
          Undangan dapat dibuka melalui tautan publiknya. Anda dapat menjeda
          undangan tanpa menghapus data atau menerbitkan ulang.
        </p>
      ) : ready ? (
        <p>
          Data wajib sudah tersedia. Terbitkan untuk membuat undangan dapat
          dibuka melalui tautan publiknya.
        </p>
      ) : (
        <Alert variant="warning" title="Draf tetap aman disimpan">
          Anda dapat melanjutkan mengisi bagian lain. Daftar ini hanya
          menunjukkan data yang diperlukan saat undangan akan diterbitkan.
        </Alert>
      )}

      {issues.length > 0 ? (
        <ul className="ed-issue-list">
          {issues.map((issue) => (
            <li
              key={`${issue.code}-${issue.section}-${issue.field ?? "section"}`}
            >
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => onSelect(issue.section)}
              >
                {issue.message}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {outcome?.kind === "published" ? (
        <Alert variant="success" title="Undangan diterbitkan">
          {outcome.publicUrl === "" ? (
            "Undangan Anda sudah aktif pada tautan publiknya."
          ) : (
            <>
              Undangan Anda aktif di{" "}
              <a href={outcome.publicUrl}>{outcome.publicUrl}</a>.
            </>
          )}
        </Alert>
      ) : null}

      {outcome?.kind === "unavailable" ? (
        <Alert variant="error" title="Publikasi belum berhasil">
          Layanan publikasi sedang tidak tersedia. Draf Anda tetap tersimpan;
          coba terbitkan lagi nanti.
        </Alert>
      ) : null}

      {outcome?.kind === "stale" ? (
        <Alert variant="warning" title="Draf berubah di tempat lain">
          Muat ulang halaman ini agar penerbitan memakai versi terbaru.
        </Alert>
      ) : null}

      {outcome?.kind === "entitlement-required" ? (
        <Alert variant="warning" title="Paket undangan belum aktif">
          Draf tetap gratis disusun, tetapi penerbitan memerlukan pembayaran.{" "}
          <a href={outcome.checkoutUrl}>Selesaikan pembayaran</a> untuk
          mengaktifkan undangan ini.
        </Alert>
      ) : null}

      {outcome?.kind === "forbidden" ? (
        <Alert variant="error" title="Tidak dapat menerbitkan">
          Akun ini tidak memiliki akses untuk menerbitkan undangan.
        </Alert>
      ) : null}

      {lifecycleOutcome?.kind === "paused" ? (
        <Alert variant="success" title="Undangan dijeda">
          Tamu tidak dapat membuka undangan sampai Anda mengaktifkannya kembali.
        </Alert>
      ) : null}

      {lifecycleOutcome?.kind === "resumed" ? (
        <Alert variant="success" title="Undangan aktif kembali">
          Tautan publik dan tautan personal kembali dapat digunakan.
        </Alert>
      ) : null}

      {lifecycleOutcome?.kind === "invalid" ? (
        <Alert variant="warning" title="Status undangan belum dapat diubah">
          Undangan perlu diterbitkan terlebih dahulu sebelum dapat dijeda atau
          diaktifkan kembali.
        </Alert>
      ) : null}

      {lifecycleOutcome?.kind === "entitlement-required" ? (
        <Alert variant="warning" title="Paket undangan belum aktif">
          Aktifkan paket terlebih dahulu.{" "}
          <a href={lifecycleOutcome.checkoutUrl}>Selesaikan pembayaran</a> untuk
          menampilkan undangan kembali.
        </Alert>
      ) : null}

      {lifecycleOutcome?.kind === "unavailable" ? (
        <Alert variant="error" title="Status undangan belum tersimpan">
          Layanan publikasi sedang tidak tersedia. Coba lagi tanpa mengubah data
          undangan.
        </Alert>
      ) : null}

      {lifecycleOutcome?.kind === "forbidden" ? (
        <Alert variant="error" title="Tidak dapat mengubah status">
          Akun ini tidak memiliki akses untuk mengubah status undangan.
        </Alert>
      ) : null}

      <div className="ed-readiness__actions">
        {canPublish ? (
          <Button
            variant="primary"
            size="md"
            loading={pending}
            onClick={onPublish}
          >
            Terbitkan undangan
          </Button>
        ) : null}
        {published ? (
          <Button
            variant="secondary"
            size="md"
            loading={lifecyclePending}
            onClick={() => onSetActive(false)}
          >
            Jeda undangan
          </Button>
        ) : null}
        {paused ? (
          <Button
            variant="primary"
            size="md"
            loading={lifecyclePending}
            onClick={() => onSetActive(true)}
          >
            Aktifkan kembali
          </Button>
        ) : null}
        {outcome?.kind === "published" &&
        outcome.publicUrl !== "" &&
        !paused ? (
          <a
            className="ui-button ui-button--secondary ui-button--md"
            href={outcome.publicUrl}
          >
            Lihat undangan publik
          </a>
        ) : null}
      </div>
    </section>
  );
}
