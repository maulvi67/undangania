import Link from "next/link";
import { Button, Input, RadioGroup, Select } from "@wedding/ui";
import {
  SORT_OPTIONS,
  filterCount,
  uniqueCategories,
  type CatalogQuery,
} from "./catalog-query";
import { TEMPLATE_TIERS, TIER_LABELS } from "../templates/template-contract";
import { getActiveTemplates } from "../templates/template-data";

/**
 * One GET form owns every named input (search, category, tier, sort), so a
 * single submission carries the full query state and the page works without
 * JavaScript. Mobile collapsing uses a native <details> panel rather than a
 * dialog-based drawer: duplicating inputs across desktop and dialog copies
 * would double-submit names, and splitting forms would lose unsubmitted
 * state. Closed <details> children still submit.
 */
export function CatalogFilters({ query }: { query: CatalogQuery }) {
  const categories = uniqueCategories(getActiveTemplates());
  const count = filterCount(query);

  return (
    <form method="get" action="/templates" className="ctlg-filters-form">
      <div className="ctlg-search">
        <Input
          id="ctlg-q"
          name="q"
          type="search"
          label="Cari desain"
          placeholder="Nama, kategori, atau karakter desain"
          defaultValue={query.q}
        />
        <Button type="submit" className="ctlg-search__submit">
          Cari
        </Button>
      </div>

      <details className="ctlg-filters" open>
        <summary className="ctlg-filters__summary">
          Filter &amp; urutkan{count > 0 ? ` · ${count}` : ""}
        </summary>

        <div className="ctlg-filters__body">
          <div className="ctlg-chips">
            <RadioGroup
              name="kategori"
              legend="Kategori"
              defaultValue={query.kategori}
              options={[
                { value: "", label: "Semua" },
                ...categories.map((category) => ({ value: category, label: category })),
              ]}
            />
          </div>

          <div className="ctlg-chips">
            <RadioGroup
              name="harga"
              legend="Level harga"
              hint="Semua level harga memiliki fitur inti yang sama; perbedaan harga mencerminkan kompleksitas visual dan aset."
              defaultValue={query.harga}
              options={[
                { value: "", label: "Semua" },
                ...TEMPLATE_TIERS.map((tier) => ({ value: tier, label: TIER_LABELS[tier] })),
              ]}
            />
          </div>

          <Select
            id="ctlg-urutkan"
            name="urutkan"
            label="Urutkan"
            defaultValue={query.urutkan}
            options={SORT_OPTIONS}
          />

          <div className="ctlg-filters__actions">
            <Button type="submit">Terapkan filter</Button>
            {count > 0 ? (
              <Link className="ctlg-filters__reset" href="/templates">
                Hapus semua
              </Link>
            ) : null}
          </div>
        </div>
      </details>
    </form>
  );
}
