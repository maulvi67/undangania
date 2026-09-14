import Link from "next/link";
import { ErrorState, StatePanel } from "@wedding/ui";

export function EditorProviderState({
  kind,
}: {
  kind: "forbidden" | "unavailable";
}) {
  if (kind === "forbidden") {
    return (
      <div className="ed-state-card">
        <StatePanel
          title="Anda belum memiliki akses"
          description="Masuk sebagai pemilik atau kolaborator workspace untuk membuka editor undangan ini."
          action={
            <div className="ed-state-actions">
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/masuk?next=%2Feditor"
              >
                Masuk
              </Link>
              <Link
                className="ui-button ui-button--secondary ui-button--md"
                href="/daftar?next=%2Feditor"
              >
                Buat akun
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="ed-state-card">
      <ErrorState
        title="Layanan editor sedang tidak tersedia"
        description="Draf Anda belum dapat dimuat karena layanan workspace sedang mengalami gangguan. Tidak ada perubahan yang dibuat pada halaman ini."
        action={
          <Link
            className="ui-button ui-button--primary ui-button--md"
            href="/editor"
          >
            Coba lagi
          </Link>
        }
      />
    </div>
  );
}
