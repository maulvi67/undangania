"use client";

import { useEffect, useState } from "react";
import { Alert, Button } from "@wedding/ui";

type ExportStatus = "idle" | "processing" | "ready";

export function GuestExportAction({
  canExport,
  initialProcessing = false,
}: {
  canExport: boolean;
  initialProcessing?: boolean;
}) {
  const [status, setStatus] = useState<ExportStatus>(
    initialProcessing ? "processing" : "idle",
  );

  useEffect(() => {
    if (!initialProcessing) return;
    const timer = window.setTimeout(() => setStatus("ready"), 450);
    return () => window.clearTimeout(timer);
  }, [initialProcessing]);

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

  const startExport = () => {
    setStatus("processing");
    window.setTimeout(() => setStatus("ready"), 450);
  };

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
      {status === "ready" ? (
        <div className="gst-export-action__ready">
          <Alert variant="success" title="Ekspor siap diunduh">
            Ini adalah simulasi UI. Pada versi produksi, file akan disediakan
            melalui job tenant-scoped yang tercatat di audit.
          </Alert>
        </div>
      ) : null}
      <Button
        type="button"
        variant="tertiary"
        loading={status === "processing"}
        onClick={startExport}
      >
        {status === "ready" ? "Siapkan ekspor lagi" : "Ekspor daftar tamu"}
      </Button>
    </div>
  );
}
