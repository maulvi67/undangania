"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  Images,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import {
  CATEGORIES,
  TEMPLATES,
  formatRupiah,
  getTemplateGradient,
  type TemplateItem,
} from "../data";
import { usePrototype } from "../store";
import {
  EmptyState,
  FilterSelect,
  PageHeader,
  ProtoButton,
  SearchField,
  StatGrid,
  StatTile,
} from "../ui";

type CategoryFilter = string;

function buildCategoryOptions(): readonly {
  value: CategoryFilter;
  label: string;
}[] {
  return [
    { value: "Semua", label: "Semua kategori" },
    ...CATEGORIES.map((slice) => ({ value: slice.name, label: slice.name })),
  ];
}

/* -------------------------------------------------------------------------- */
/* Template                                                                    */
/* -------------------------------------------------------------------------- */

export function TemplatePage() {
  const { notify } = usePrototype();
  const [category, setCategory] = useState<CategoryFilter>("Semua");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    let aktif = 0;
    let draf = 0;
    let sales = 0;
    for (const template of TEMPLATES) {
      if (template.status === "Aktif") aktif += 1;
      if (template.status === "Draf") draf += 1;
      sales += template.sales;
    }
    return { aktif, draf, sales };
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return TEMPLATES.filter((template) => {
      const matchesCategory =
        category === "Semua" || template.category === category;
      const matchesSearch =
        needle.length === 0 ||
        [template.name, template.category].some((field) =>
          field.toLowerCase().includes(needle),
        );
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const categoryOptions = useMemo(() => buildCategoryOptions(), []);

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        title="Template"
        description="Katalog desain undangan digital yang dijual di Undangania beserta performa penjualannya."
        actions={
          <ProtoButton
            variant="primary"
            onClick={() => notify("Form tambah template dibuka")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Template
          </ProtoButton>
        }
      />

      <StatGrid>
        <StatTile
          label="Total Katalog"
          value={String(TEMPLATES.length)}
          hint="Contoh dari 56 template aktif"
          icon={<Images className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Aktif"
          value={String(stats.aktif)}
          hint="Siap dijual"
          tone="emerald"
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Draf"
          value={String(stats.draf)}
          hint="Belum dipublikasikan"
          tone="amber"
          icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Terjual"
          value={String(stats.sales)}
          hint="Total pembelian"
          tone="sky"
          icon={<Package className="h-4 w-4" aria-hidden="true" />}
        />
      </StatGrid>

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--p-line)] bg-white p-4 shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)] sm:flex-row sm:items-end md:p-5">
        <SearchField
          label="Cari template"
          value={search}
          onChange={setSearch}
          placeholder="Cari nama atau kategori template..."
          className="flex-1"
        />
        <FilterSelect
          label="Kategori"
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          className="w-full sm:w-52"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
          <EmptyState
            icon={<Images className="h-5 w-5" aria-hidden="true" />}
            title="Template tidak ditemukan"
            description="Ubah kata kunci atau pilih kategori lain untuk melihat katalog."
            action={
              <ProtoButton
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategory("Semua");
                }}
              >
                Reset filter
              </ProtoButton>
            }
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => (
            <li key={template.id}>
              <TemplateCard template={template} onAction={notify} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Template card                                                               */
/* -------------------------------------------------------------------------- */

function TemplateCard({
  template,
  onAction,
}: {
  template: TemplateItem;
  onAction: (message: string) => void;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[20px] border border-[var(--p-line)] bg-white shadow-[0_16px_44px_-32px_rgba(82,52,55,0.5)]">
      <div
        aria-hidden="true"
        className="relative h-[132px] w-full"
        style={{ background: getTemplateGradient(template.name) }}
      >
        <span className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <span className="absolute bottom-3 left-4 right-4 truncate">
          <span className="proto-display block truncate text-[17px] font-semibold text-white">
            {template.name}
          </span>
          <span className="block text-[11px] text-white/75">
            {template.category}
          </span>
        </span>
        <span
          className={
            template.status === "Aktif"
              ? "absolute right-3 top-3 rounded-full border border-emerald-200 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
              : "absolute right-3 top-3 rounded-full border border-amber-200 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
          }
        >
          {template.status}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-3 text-[12px]">
          <span className="proto-nums font-semibold text-[var(--p-ink)]">
            {formatRupiah(template.price)}
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--p-ink-soft)]">
            <Star
              className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
              aria-hidden="true"
            />
            <span className="proto-nums font-semibold text-[var(--p-ink)]">
              {template.rating}
            </span>
          </span>
        </div>

        <p className="proto-nums mt-2 text-[11px] text-[var(--p-ink-soft)]">
          {template.sales} terjual
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <ProtoButton
            size="sm"
            onClick={() => onAction(`Pratinjau ${template.name} dibuka`)}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Pratinjau
          </ProtoButton>
          <ProtoButton
            size="sm"
            onClick={() =>
              onAction(
                template.status === "Aktif"
                  ? `${template.name} dijadikan draf`
                  : `${template.name} dipublikasikan`,
              )
            }
          >
            {template.status === "Aktif" ? (
              <>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Jadikan Draf
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Publikasikan
              </>
            )}
          </ProtoButton>
        </div>
      </div>
    </article>
  );
}
