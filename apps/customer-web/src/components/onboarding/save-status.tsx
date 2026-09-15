export type SaveNotice = "idle" | "saving" | "saved";

/**
 * Status simpan sopan (rencana §6): "Menyimpan…" → "Tersimpan." pada
 * role=status — diumumkan tanpa pernah mencuri fokus. Region selalu
 * dirender agar pergantian teks benar-benar diumumkan.
 */
export function SaveStatus({ notice }: { notice: SaveNotice }) {
  return (
    <p className="onb-save-status" role="status">
      {notice === "saving"
        ? "Menyimpan…"
        : notice === "saved"
          ? "Tersimpan."
          : ""}
    </p>
  );
}
