"use client";

import { useState } from "react";
import { Alert, Button } from "@wedding/ui";
import { exportGuestRosterAction } from "../../lib/guests/actions";

type ExportStatus = "idle" | "processing" | "error";

function downloadCsv(
  filename: string,
  csv: string,
  contentType: string,
): void {
  const blob = new Blob(["\uFEFF", csv], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function GuestExportAction({
  canExport,
  householdIds,
}: {
  canExport: boolean;
  householdIds?: readonly string[];
}) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const startExport = async () => {
    setStatus("processing");
    setMessage(null);
    try {
      const outcome = await exportGuestRosterAction({
        ...(householdIds === undefined ? {} : { householdIds: [...householdIds] }),
      });
      if (outcome.kind !== "ok") {
        setStatus("error");
        setMessage(
          outcome.kind === "forbidden"
            ? "Anda tidak memiliki izin untuk mengekspor daftar tamu."
            : outcome.kind === "not-found"
              ? "Sebagian rumah tangga tidak ditemukan di workspace Anda."
              : outcome.kind === "invalid"
                ? (outcome.errors[0] ?? "Pilihan ekspor tidak valid.")
                : "Ekspor belum dapat dibuat. Silakan coba lagi.",
        );
        return;
      }
      downloadCsv(outcome.filename, outcome.csv, outcome.contentType);
      setStatus("idle");
      setMessage(
        `${outcome.householdCount} rumah tangga dan ${outcome.guestCount} tamu diekspor.`,
      );
    } catch {
      setStatus("error");
      setMessage("Ekspor belum dapat dibuat. Silakan coba lagi.");
    }
  };

  if (!canExport) {
    return (
      <div className="gst-export-action gst-export-action--restricted">
        <Button type="button" variant="tertiary" disabled>
          Ekspor daftar tamu
        </Button>
        <p className="gst-permission-note" role="status">
          Ekspor hanya tersedia untuk anggota workspace dengan izin yang sesuai.
        </p>
      </div>
    );
  }

  return (
    <div className="gst-export-action">
      {status === "processing" ? (
        <p
          className="gst-export-action__status"
          role="status"
          aria-live="polite"
        >
          Menyiapkan ekspor…
        </p>
      ) : null}
      {message !== null ? (
        <div className="gst-export-action__ready">
          <Alert
            variant={status === "error" ? "warning" : "success"}
            title={status === "error" ? "Ekspor gagal" : "Ekspor selesai"}
          >
            {message}
          </Alert>
        </div>
      ) : null}
      <Button
        type="button"
        variant="tertiary"
        loading={status === "processing"}
        disabled={status === "processing"}
        onClick={() => void startExport()}
      >
        Ekspor daftar tamu
      </Button>
    </div>
  );
}
