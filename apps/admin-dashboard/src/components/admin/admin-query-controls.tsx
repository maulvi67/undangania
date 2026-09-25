"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function AdminQueryControls({
  page,
  limit,
  search,
}: {
  page: number;
  limit: number;
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentParams = useSearchParams();
  const [value, setValue] = useState(search);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(currentParams.toString());
    const nextSearch = value.trim();
    params.set("page", "1");
    params.set("limit", String(limit));
    if (nextSearch.length > 0) params.set("search", nextSearch);
    else params.delete("search");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form className="grid w-full gap-2 sm:flex sm:w-auto sm:items-end" onSubmit={submit} role="search">
      <label className="grid min-w-0 gap-1 text-xs font-bold text-[var(--color-ink-soft)] sm:w-64" htmlFor="admin-search">
        Cari operasi
        <Input id="admin-search" type="search" value={value} maxLength={100} onChange={(event) => setValue(event.target.value)} placeholder="ID, referensi, aksi…" />
      </label>
      <Button variant="secondary" size="sm" type="submit">Terapkan</Button>
      <span className="ui-visually-hidden" aria-live="polite">Halaman {page}, maksimal {limit} baris per bagian.</span>
    </form>
  );
}
