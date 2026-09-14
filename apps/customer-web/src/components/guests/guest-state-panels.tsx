import Link from "next/link";
import { Button, EmptyState, ErrorState, StatePanel } from "@wedding/ui";
import type { GuestLoadResult } from "../../lib/guests/contract";

export function GuestPermissionDenied() {
  return (
    <div className="gst-state" role="alert">
      <StatePanel
        title="Anda tidak memiliki akses ke daftar tamu"
        description="Minta pemilik workspace memberi Anda izin untuk melihat dan mengelola tamu."
        action={<Link className="ui-button ui-button--secondary ui-button--md" href="/dashboard">Kembali ke dasbor</Link>}
        tone="danger"
      />
    </div>
  );
}

export function GuestUnavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="gst-state">
      <ErrorState
        title="Daftar tamu belum tersedia"
        description="Layanan tamu sedang tidak tersedia. Coba muat ulang halaman ini atau kembali lagi sebentar."
        action={
          onRetry ? (
            <Button type="button" variant="primary" onClick={onRetry}>
              Coba lagi
            </Button>
          ) : (
            <a className="ui-button ui-button--primary ui-button--md" href="/tamu">
              Coba lagi
            </a>
          )
        }
      />
    </div>
  );
}

export function GuestEmpty({ filtered = false }: { filtered?: boolean }) {
  if (filtered) {
    return (
      <EmptyState
        title="Tidak ada rumah tangga yang cocok"
        description="Coba ubah kata kunci atau hapus filter untuk melihat rumah tangga lainnya."
        action={
          <a className="ui-button ui-button--secondary ui-button--md" href="/tamu">
            Hapus semua filter
          </a>
        }
      />
    );
  }
  return (
    <EmptyState
      title="Belum ada tamu"
      description="Mulai dengan menambahkan rumah tangga pertama, atau unggah daftar tamu dari template CSV."
      action={
        <div className="gst-empty__actions">
          <Link className="ui-button ui-button--primary ui-button--md" href="/tamu/baru">
            Tambah rumah tangga
          </Link>
          <Link className="ui-button ui-button--secondary ui-button--md" href="/tamu/impor">
            Impor CSV
          </Link>
        </div>
      }
    />
  );
}

export function GuestRouteState({ result }: { result: GuestLoadResult }) {
  if (result.kind === "forbidden") return <GuestPermissionDenied />;
  if (result.kind === "unavailable") return <GuestUnavailable />;
  return null;
}
