"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/button";

export function AdminRefreshControl() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <span>
      <Button variant="secondary" size="sm" type="button" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>
        {refreshing ? "Memperbarui…" : "Perbarui"}
      </Button>
      <span className="ui-visually-hidden" role="status" aria-live="polite">
        {refreshing ? "Memuat ulang data operasi." : ""}
      </span>
    </span>
  );
}
