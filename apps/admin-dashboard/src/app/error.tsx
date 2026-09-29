"use client";

import { useEffect } from "react";
import { Button } from "../components/ui/button";

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
    <main className="grid min-h-[100dvh] place-items-center px-4 py-8" aria-labelledby="admin-error-title">
      <div className="grid w-full max-w-xl gap-4 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-[0_12px_32px_rgba(36,52,47,0.06)] sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--color-accent-strong)]">Undangania Operations</p>
        <h1 id="admin-error-title" className="text-3xl font-bold tracking-tight">Konsol operasi mengalami kendala</h1>
        <p className="text-[var(--color-ink-soft)]">Data belum dapat dimuat. Coba lagi tanpa mengubah status operasional apa pun.</p>
        <Button variant="primary" onClick={reset}>Coba lagi</Button>
      </div>
    </main>
  );
}
