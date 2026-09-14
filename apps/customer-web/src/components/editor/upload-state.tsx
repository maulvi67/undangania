import { Alert, Badge } from "@wedding/ui";
import type { EditorMediaState } from "../../lib/editor/contract";

const labels: Record<EditorMediaState, string> = {
  PENDING_UPLOAD: "Menunggu unggah",
  UPLOADED: "Sudah diunggah",
  SCANNING: "Sedang diperiksa",
  PROCESSING: "Sedang diproses",
  READY: "Siap digunakan",
  REJECTED: "Ditolak",
  DELETED: "Dihapus",
};

export function UploadState({
  state,
  rejectionReason,
}: {
  state: EditorMediaState;
  rejectionReason: string | null;
}) {
  if (state === "REJECTED") {
    return (
      <Alert variant="error" title="Media tidak dapat digunakan">
        {rejectionReason ?? "Periksa format dan ukuran file, lalu coba lagi."}
      </Alert>
    );
  }
  return (
    <p className="ed-upload-state">
      <Badge
        tone={
          state === "READY"
            ? "olive"
            : state === "PROCESSING" || state === "SCANNING"
              ? "gold"
              : "neutral"
        }
      >
        {labels[state]}
      </Badge>
    </p>
  );
}
