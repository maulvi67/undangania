import { useId, useRef, useState } from "react";
import { Alert, Button } from "@wedding/ui";
import { GuestDialog } from "./guest-dialog";
import { GuestExportAction } from "./guest-export-action";

export function GuestBulkActions({
  selectedCount,
  selectedIds,
  canExport,
}: {
  selectedCount: number;
  selectedIds: readonly string[];
  canExport: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (selectedCount === 0) return null;
  return (
    <div className="gst-bulk" aria-label="Tindakan rumah tangga terpilih">
      <p>
        <strong>{selectedCount}</strong> dipilih
      </p>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={dialogId}
        aria-haspopup="dialog"
      >
        Tindakan
      </Button>
      {notice ? (
        <div className="gst-bulk__notice">
          <Alert variant="warning" title="Tag belum tersedia">
            Tag belum dapat disimpan karena workspace ini belum memiliki tabel tag.
          </Alert>
        </div>
      ) : null}
      <GuestDialog
        id={dialogId}
        open={open}
        title={`${selectedCount} rumah tangga dipilih`}
        description="Pilih tindakan yang aman untuk beberapa rumah tangga sekaligus."
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
      >
        <div className="gst-bulk__drawer">
          <Button
            type="button"
            onClick={() => {
              setNotice(true);
              setOpen(false);
            }}
          >
            Tambahkan tag
          </Button>
          {canExport ? (
            <GuestExportAction
              canExport
              householdIds={selectedIds}
            />
          ) : null}
          <p className="gst-bulk__note">
            Ganti atau nonaktifkan tautan tetap dilakukan satu per satu untuk
            mencegah pencabutan akses yang tidak disengaja.
          </p>
        </div>
      </GuestDialog>
    </div>
  );
}
