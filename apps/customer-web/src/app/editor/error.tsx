"use client";

import { ErrorState } from "@wedding/ui";

export default function EditorError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="ed-page ed-page--state">
      <div className="ed-state-card">
        <ErrorState
          title="Editor tidak dapat dimuat"
          description="Draf undangan belum dapat dibuka. Coba muat ulang halaman ini. Perubahan yang belum terkirim tetap berada di perangkat bila pemulihan lokal tersedia."
          action={
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--md"
              onClick={reset}
            >
              Coba lagi
            </button>
          }
        />
      </div>
    </main>
  );
}
