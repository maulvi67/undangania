import Link from "next/link";
import { Button, Input, Select } from "@wedding/ui";
import {
  formatGuestSort,
  guestQueryHref,
  type GuestEvent,
  type GuestListQuery,
  type GuestTag,
} from "../../lib/guests/contract";

export function GuestFilters({
  query,
  events,
  tags,
}: {
  query: GuestListQuery;
  events: readonly GuestEvent[];
  tags: readonly GuestTag[];
}) {
  const activeCount = [query.tag, query.event, query.link].filter(
    Boolean,
  ).length;
  return (
    <form method="get" action="/tamu" className="gst-filters-form">
      <div className="gst-search-row">
        <Input
          id="gst-search"
          name="q"
          type="search"
          label="Cari rumah tangga atau tamu"
          placeholder="Contoh: Keluarga Budi"
          defaultValue={query.q}
        />
        <Button type="submit" className="gst-search-row__submit">
          Cari
        </Button>
      </div>

      <details className="gst-filter-drawer" open>
        <summary className="gst-filter-drawer__summary">
          Filter &amp; urutkan{activeCount > 0 ? ` · ${activeCount}` : ""}
        </summary>
        <div className="gst-filter-drawer__body">
          <Select
            id="gst-tag"
            name="tag"
            label="Tag"
            defaultValue={query.tag}
            options={[
              { value: "", label: "Semua tag" },
              ...tags.map((tag) => ({ value: tag.label, label: tag.label })),
            ]}
          />
          <Select
            id="gst-event"
            name="event"
            label="Akses acara"
            defaultValue={query.event}
            options={[
              { value: "", label: "Semua acara" },
              ...events.map((event) => ({
                value: event.title,
                label: event.title,
              })),
            ]}
          />
          <Select
            id="gst-link"
            name="link"
            label="Status tautan"
            defaultValue={query.link}
            options={[
              { value: "", label: "Semua status" },
              { value: "ACTIVE", label: "Aktif" },
              { value: "DISABLED", label: "Dinonaktifkan" },
            ]}
          />
          <Select
            id="gst-sort"
            name="sort"
            label="Urutkan"
            defaultValue={query.sort}
            options={[
              { value: "name", label: formatGuestSort("name") },
              { value: "updated", label: formatGuestSort("updated") },
              { value: "pax-desc", label: formatGuestSort("pax-desc") },
              { value: "pax-asc", label: formatGuestSort("pax-asc") },
            ]}
          />
          <div className="gst-filter-drawer__actions">
            <Button type="submit">Terapkan filter</Button>
            {activeCount > 0 || query.q ? (
              <Link
                className="gst-filter-drawer__reset"
                href="/tamu"
              >
                Hapus semua
              </Link>
            ) : null}
          </div>
        </div>
      </details>
    </form>
  );
}

export function GuestFilterTokens({ query }: { query: GuestListQuery }) {
  type FilterToken = {
    label: string;
    patch: Partial<GuestListQuery>;
  };
  const tokens: Array<FilterToken | null> = [
    query.q ? { label: `Cari: ${query.q}`, patch: { q: "" } } : null,
    query.tag ? { label: `Tag: ${query.tag}`, patch: { tag: "" } } : null,
    query.event
      ? { label: `Acara: ${query.event}`, patch: { event: "" } }
      : null,
    query.link
      ? {
          label: `Status: ${query.link === "ACTIVE" ? "Aktif" : "Dinonaktifkan"}`,
          patch: { link: "" },
        }
      : null,
  ];
  const activeTokens = tokens.filter(
    (token): token is FilterToken => token !== null,
  );
  if (activeTokens.length === 0) return null;
  return (
    <div className="gst-filter-tokens" aria-label="Filter aktif">
      {activeTokens.map((token) => (
        <Link
          key={token.label}
          className="gst-filter-token"
          href={guestQueryHref(query, token.patch)}
        >
          {token.label} <span aria-hidden="true">×</span>
        </Link>
      ))}
      <Link
        className="gst-filter-token__clear"
        href="/tamu"
      >
        Hapus semua
      </Link>
    </div>
  );
}
