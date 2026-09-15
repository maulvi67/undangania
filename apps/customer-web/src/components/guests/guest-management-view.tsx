"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Badge, Checkbox } from "@wedding/ui";
import type {
  GuestListQuery,
  GuestManagementData,
} from "../../lib/guests/contract";
import { GuestBulkActions } from "./guest-bulk-actions";
import { GuestFilterTokens, GuestFilters } from "./guest-filters";
import { GuestHouseholdCard } from "./guest-household-card";
import { GuestHouseholdRow } from "./guest-household-row";
import { GuestEmpty } from "./guest-state-panels";
import { GuestExportAction } from "./guest-export-action";

export function GuestManagementView({
  data,
  query,
}: {
  data: GuestManagementData;
  query: GuestListQuery;
}) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const allSelected =
    data.households.length > 0 &&
    data.households.every((item) => selectedIds.has(item.id));
  const filtered =
    query.q !== "" ||
    query.tag !== "" ||
    query.event !== "" ||
    query.link !== "";
  const selectedCount = selectedIds.size;
  const toggleSelected = (id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const visibleIds = useMemo(
    () => data.households.map((item) => item.id),
    [data.households],
  );
  const toggleAll = (selected: boolean) => {
    setSelectedIds(selected ? new Set(visibleIds) : new Set());
  };

  return (
    <div className="gst-page">
      <header className="gst-page__header">
        <div>
          <p className="gst-eyebrow">Workspace pernikahan</p>
          <h1>Tamu</h1>
          <p className="gst-page__lead">
            Kelola rumah tangga, atur akses acara, dan siapkan tautan personal
            untuk setiap undangan.
          </p>
        </div>
        <div className="gst-page__actions">
          {data.capabilities.canImport ? (
            <Link
              className="ui-button ui-button--secondary ui-button--md"
              href={
                query.fixture === "normal"
                  ? "/tamu/impor"
                  : `/tamu/impor?fixture=${query.fixture}`
              }
            >
              Impor CSV
            </Link>
          ) : null}
          {data.capabilities.canWrite ? (
            <Link
              className="ui-button ui-button--primary ui-button--md"
              href={
                query.fixture === "normal"
                  ? "/tamu/baru"
                  : `/tamu/baru?fixture=${query.fixture}`
              }
            >
              Tambah rumah tangga
            </Link>
          ) : null}
        </div>
      </header>

      <section className="gst-summary" aria-label="Ringkasan tamu">
        <div>
          <strong>{data.households.length}</strong>
          <span>rumah tangga ditampilkan</span>
        </div>
        <div>
          <strong>{data.totalGuests}</strong>
          <span>tamu dalam hasil ini</span>
        </div>
        <div>
          <strong>{data.events.length}</strong>
          <span>acara tersedia</span>
        </div>
      </section>

      {data.notice ? (
        <div className="gst-notice">
          <Alert variant={data.notice.tone} title={data.notice.title}>
            {data.notice.body}
          </Alert>
        </div>
      ) : null}

      <section className="gst-controls" aria-labelledby="gst-controls-title">
        <h2 id="gst-controls-title" className="ui-visually-hidden">
          Cari dan filter tamu
        </h2>
        <GuestFilters query={query} events={data.events} tags={data.tags} />
        <GuestFilterTokens query={query} />
      </section>

      {data.households.length === 0 ? (
        <GuestEmpty filtered={filtered} />
      ) : (
        <section className="gst-results" aria-labelledby="gst-results-title">
          <div className="gst-results__header">
            <div>
              <p className="gst-eyebrow">Daftar rumah tangga</p>
              <h2 id="gst-results-title">{data.households.length} hasil</h2>
            </div>
            <div className="gst-results__actions">
              <Badge tone={data.capabilities.canExport ? "neutral" : "blush"}>
                {data.capabilities.canExport
                  ? "Ekspor tersedia"
                  : "Ekspor tidak tersedia"}
              </Badge>
              <GuestBulkActions selectedCount={selectedCount} />
            </div>
          </div>

          <div className="gst-desktop-list">
            <table className="gst-table">
              <caption className="ui-visually-hidden">
                Daftar rumah tangga tamu
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <Checkbox
                      id="select-all-households"
                      label="Pilih semua rumah tangga yang terlihat"
                      checked={allSelected}
                      onChange={(event) => toggleAll(event.target.checked)}
                    />
                  </th>
                  <th scope="col">Rumah tangga</th>
                  <th scope="col">Maksimal pax</th>
                  <th scope="col">Akses acara</th>
                  <th scope="col">Tag</th>
                  <th scope="col">Tautan</th>
                  <th scope="col">
                    <span className="ui-visually-hidden">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.households.map((household) => (
                  <GuestHouseholdRow
                    key={household.id}
                    household={household}
                    query={query}
                    selected={selectedIds.has(household.id)}
                    onSelectedChange={(selected) =>
                      toggleSelected(household.id, selected)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="gst-mobile-list"
            aria-label="Daftar rumah tangga versi mobile"
          >
            <div className="gst-mobile-list__select-all">
              <Checkbox
                id="select-all-households-mobile"
                label="Pilih semua rumah tangga yang terlihat"
                checked={allSelected}
                onChange={(event) => toggleAll(event.target.checked)}
              />
            </div>
            {data.households.map((household) => (
              <GuestHouseholdCard
                key={household.id}
                household={household}
                query={query}
                selected={selectedIds.has(household.id)}
                onSelectedChange={(selected) =>
                  toggleSelected(household.id, selected)
                }
              />
            ))}
          </div>

          <p className="gst-results__privacy">
            Kontak tamu disembunyikan di daftar untuk menjaga privasi. Buka satu
            rumah tangga untuk mengelola detailnya.
          </p>
        </section>
      )}

      <GuestExportAction
        canExport={data.capabilities.canExport}
        initialProcessing={query.fixture === "export-processing"}
      />
    </div>
  );
}
