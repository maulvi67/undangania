"use client";

import { useEffect } from "react";
import { Button } from "@wedding/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Runtime logging is intentionally limited to the error boundary.
    console.error(error);
  }, [error]);

  return (
    <main className="admin-state-page" aria-labelledby="admin-error-title">
      <div className="admin-state-page__inner">
        <p className="admin-eyebrow">Wedding System Operations</p>
        <h1 id="admin-error-title">Konsol operasi mengalami kendala</h1>
        <p>
          Data belum dapat dimuat. Coba lagi tanpa mengubah status operasional
          apa pun.
        </p>
        <Button variant="primary" onClick={reset}>
          Coba lagi
        </Button>
      </div>
    </main>
  );
}
