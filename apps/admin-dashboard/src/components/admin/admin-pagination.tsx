import Link from "next/link";


export function AdminPagination({ page, limit, search, hasNextPage }: { page: number; limit: number; search: string; hasNextPage: boolean }) {
  if (page === 1 && !hasNextPage) return null;
  function href(nextPage: number): string { const params = new URLSearchParams(); params.set("page", String(nextPage)); params.set("limit", String(limit)); if (search.length > 0) params.set("search", search); return `/?${params.toString()}`; }
  return <nav className="flex items-center justify-between gap-4 text-sm text-[var(--color-ink-soft)]" aria-label="Paginasi bagian">{page > 1 ? <Link className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--color-accent)] bg-white px-3 text-xs font-bold text-[var(--color-accent-strong)] no-underline hover:bg-[var(--color-panel-muted)]" href={href(page - 1)}>Sebelumnya</Link> : <span /> }<span aria-current="page" className="font-bold">Halaman {page}</span>{hasNextPage ? <Link className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--color-accent)] bg-white px-3 text-xs font-bold text-[var(--color-accent-strong)] no-underline hover:bg-[var(--color-panel-muted)]" href={href(page + 1)}>Berikutnya</Link> : <span />}</nav>;
}
