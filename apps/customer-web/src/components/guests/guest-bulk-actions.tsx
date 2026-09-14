import { useRef, useState } from "react";
import { Alert, Button } from "@wedding/ui";
import { GuestDialog } from "./guest-dialog";

export function GuestBulkActions({ selectedCount }: { selectedCount: number }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (selectedCount === 0) return null;
  return (
    <div className="gst-bulk" aria-label="Tindakan rumah tangga terpilih">
      <p>
        <strong>{selectedCount}</strong> dipilih
      </p>
      <Button ref={triggerRef} type="button" variant="secondary" onClick={() => setOpen(true)}>
        Tindakan
      </Button>
      {notice ? (
        <div className="gst-bulk__notice">
          <Alert variant="success" title="Tindakan disimpan">
            Pada versi produksi, tag dan ekspor akan diproses melalui layanan tenant-scoped.
          </Alert>
        </div>
      ) : null}
      <GuestDialog
        open={open}
        title={`${selectedCount} rumah tangga dipilih`}
        description="Pilih tindakan yang aman untuk beberapa rumah tangga sekaligus."
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
      >
        <div className="gst-bulk__drawer">
          <Button type="button" onClick={() => { setNotice(true); setOpen(false); }}>
            Tambahkan tag
          </Button>
          <Button type="button" variant="secondary" onClick={() => { setNotice(true); setOpen(false); }}>
            Ekspor pilihan
          </Button>
          <p className="gst-bulk__note">Ganti atau nonaktifkan tautan tetap dilakukan satu per satu untuk mencegah pencabutan akses yang tidak disengaja.</p>
        </div>
      </GuestDialog>
    </div>
  );
}
