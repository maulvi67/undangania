"use client";

import { Alert, Button } from "@wedding/ui";
import type {
  PublicationReadiness,
  EditorSectionId,
} from "../../lib/editor/contract";
import type { PublishOutcome } from "../../lib/editor/publish-action";

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
  onSelect,
  onPublish,
  pending,
  outcome,
}: {
  readiness: PublicationReadiness;
  onSelect: (section: EditorSectionId) => void;
  onPublish: () => void;
  pending: boolean;
  outcome: PublishOutcome | null;
}) {
  const issues =
    outcome?.kind === "not-ready" ? outcome.readiness.issues : readiness.issues;
  const ready = outcome?.kind === "not-ready" ? false : readiness.ready;

  return (
    <section
      className={`ed-readiness${ready ? " ed-readiness--ready" : ""}`}
      aria-labelledby="ed-readiness-title"
    >
      <div className="ed-readiness__heading">
        <div>
          <p className="ed-panel__eyebrow">Pemeriksaan publikasi</p>
          <h2 id="ed-readiness-title">
            {ready ? "Siap diterbitkan" : "Masih ada yang perlu dilengkapi"}
          </h2>
        </div>
        {ready ? null : (
          <span className="ed-readiness__count">{issues.length} hal</span>
        )}
      </div>

      {ready ? (
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

      {outcome?.kind === "forbidden" ? (
        <Alert variant="error" title="Tidak dapat menerbitkan">
          Akun ini tidak memiliki akses untuk menerbitkan undangan.
        </Alert>
      ) : null}

      <div className="ed-readiness__actions">
        {ready ? (
          <Button
            variant="primary"
            size="md"
            loading={pending}
            onClick={onPublish}
          >
            Terbitkan undangan
          </Button>
        ) : null}
        {outcome?.kind === "published" && outcome.publicUrl !== "" ? (
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
