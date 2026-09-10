"use client";

import { Button, ErrorState } from "@wedding/ui";
import "../catalog.css";

export default function CatalogErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="ui-shell">
      <main id="konten-utama" tabIndex={-1}>
        <div className="ui-container ctlg-page">
          <ErrorState
            title="Katalog gagal dimuat"
            description="Terjadi kesalahan saat memuat katalog desain. Silakan coba lagi."
            action={
              <Button type="button" onClick={reset}>
                Coba lagi
              </Button>
            }
          />
        </div>
      </main>
    </div>
  );
}
