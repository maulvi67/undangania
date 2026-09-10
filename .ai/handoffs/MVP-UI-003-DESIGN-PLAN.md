# Design Plan — MVP-UI-003 Template Catalog

Status: AWAITING APPROVAL — no code written yet.

## 1. User decision model

Couples arrive from the landing page knowing only "all templates include the same
core features; price reflects design." The catalog's job is to convert vague taste
into one confident pick in under three minutes.

Decision funnel (mirrors how couples actually choose an invitation):

1. **Orient (0–15s):** scan the grid to grasp the range of visual characters.
2. **Narrow (15–60s):** filter by category (formal / modern / traditional-leaning)
   and, if budget-conscious, by price tier. Search by name/keyword for returning
   visitors who heard of a template.
3. **Compare (60–120s):** open 1–2 demos in new tabs, compare side by side.
   Comparison is between *looks*, never features — cards never imply otherwise.
4. **Commit (120–180s):** click "Pilih desain" on the winner.

Design implications:
- The "same core, different character" message is stated once at section level and
  echoed in the price filter — not repeated as badges on every card (badge overload
  dilutes it and implies per-card differences).
- Sort default is **Terbaru** (explicitly labeled in the select) — new designs first
  supports scanning without implying ranking by quality or popularity (no popularity
  signals exist; faking them is forbidden).
- Favorites/shortlist: **skipped for MVP.** It requires auth + persistence (MVP-UI-005+),
  serves the compare step poorly (demos in tabs compare better), and adds state this
  route cannot keep honestly. Revisit after auth lands.

## 2. Card information hierarchy

Top to bottom (nothing critical hidden behind hover):

1. **Preview** — reserved 3:4 box, mobile-invitation-shaped (the artifact customers buy).
2. **Category** — small eyebrow text (e.g. "Klasik").
3. **Name** — template name, heading level 3.
4. **Design character** — one line of body text describing the visual character
   (typography/ornament/palette mood).
5. **Price** — final amount, currency Rp, plus tier note rendered as plain text
   ("Desain detail" etc.) — tier names describe *craft*, never functionality.
6. **CTAs** — "Lihat demo" (secondary link → `/demo` or template detail when it
   exists) and "Pilih desain" (primary → template detail / onboarding).

Explicitly absent: ratings, usage counts, "popular" flags, feature badges,
countdowns/scarcity, hover-only CTAs.

## 3. Filter and search behavior

- **URL is the single source of truth:** `/templates?q=&kategori=&harga=&urutkan=`.
  Every filter change is a URL change; server renders from `searchParams`
  (Next.js 15 async `searchParams`). Back/forward works; results are shareable.
- **Progressive enhancement:** the control bar is one native `<form method="get">`
  (search input + category + tier + sort + "Terapkan"). Works with JavaScript
  disabled. Optional client enhancement later; none required for MVP.
- **Search:** matches name, category, and design-character text; case-insensitive;
  trimmed; empty `q` = no filter. Submitted via Enter / "Cari" button.
- **Category filter:** single-select radio group (Semua / Klasik / Modern / ...exact
  set comes from the data fixture's categories). Single-select keeps the mental
  model simple; multi-select rarely helps at MVP catalog size.
- **Price tier filter:** single-select radio group (Semua / tier labels — open
  decision below). A short helper line under the control: "Semua desain — di semua
  level harga — memiliki fitur inti yang sama. Perbedaan harga mencerminkan
  kompleksitas visual dan aset."
- **Sort:** `<select>` with explicit options: Terbaru (default) / Harga terendah /
  Harga tertinggi / Nama A–Z. Default is visible as the selected option, never hidden.
- **Active filters:** shown as removable tokens under the control bar with a
  "Hapus semua" link; removing a token drops that param from the URL.
- **Result count:** "Menampilkan X desain" after each applied change.
- **No request storms:** every interaction is exactly one navigation; no fetch
  per keystroke (no debounce layer to misfire in MVP).

## 4. Mobile filter behavior

- Search field stays **inline and always visible** above the grid (search is the
  primary narrow-by-taste action).
- Filters + sort live behind a "Filter" button (with active-count badge, e.g.
  "Filter · 2") that opens the existing `Drawer` component from `@wedding/ui`
  (left side, native `<dialog>`, focus trap, Escape to close).
- The drawer contains the same GET form (search omitted — already inline):
  category radios, tier radios, sort select, "Terapkan filter" (submit) and
  "Hapus semua" (reset) buttons.
- Applying closes the drawer, updates the URL, and moves focus to the results
  heading.
- Active filter tokens remain visible under the search field on mobile so the
  current state is never hidden behind the button.

## 5. Empty / error / loading states

- **No search results** (query or filters active): EmptyState — "Tidak ada desain
  yang cocok dengan pencarian Anda." + actions: "Hapus semua filter" link and a
  hint to try a different keyword. Never shows suggestions that don't exist.
- **Empty catalog** (zero ACTIVE templates — fixture empty): distinct honest state:
  "Koleksi belum tersedia" + link back to landing. No filler cards, no fake items.
- **Loading:** `templates/loading.tsx` — skeleton grid using ui `Skeleton`, each
  skeleton the exact dimensions of a real card (3:4 preview + text lines) so there
  is no layout shift. The shell (header/search bar) is static; only the grid
  suspenses via `Suspense`.
- **Error:** `templates/error.tsx` — ErrorState with "Coba lagi" (re-render);
  message is generic; no stack traces or internal details leaked.

## 6. Keyboard navigation

- DOM order = logical order: header → search field → Filter button (mobile) →
  active filter tokens → result count/heading → cards → footer.
- Cards are not single hyperlinks; each card's CTAs are real links, so each card
  contributes two tab stops (demo, select) after its text. Cards grouped in an
  unordered list (`ul > li`), name as `h3`.
- All controls are native (`input[type=search]`, `radio`, `select`, `button`,
  `a`); focus indicators come from ui tokens (`:focus-visible`). No hover-only
  affordances. Drawer inherits the ui package's focus trap + Escape + focus return
  (validated on the landing page already).
- Filter form uses `<fieldset>`/`<legend>` per group; the sort `<select>` has a
  visible label.

## 7. SEO and metadata

- Route metadata: title "Katalog Desain Undangan Pernikahan — Wedding System",
  description in Bahasa Indonesia mentioning same-core-features and design
  characters, canonical **`/templates`** (query params never canonicalized —
  filtered views canonical to the base URL), OG locale `id_ID`.
- One `h1`: "Pilih desain undangan Anda" (matches existing e2e expectation of
  "Pilih desain").
- `CollectionPage` JSON-LD with an `ItemList` of template names (no fake
  aggregateRating — omitted entirely).
- Filtered/sorted views: noindex is unnecessary given canonical; robots default
  index on `/templates`.

## 8. Performance strategy

- Route is dynamic (searchParams) but the shell is static; only the results grid
  is inside `Suspense` — framework streams it. Initial HTML still carries filters.
- Zero template renderers bundled — task rule; catalog consumes catalog metadata
  (fixture) only, never `template-engine` renderer code.
- No client components required except the `Drawer` island (same as landing).
- Data fixture is a module constant — filtering/sorting is synchronous in-memory;
  "no request storms" is trivially satisfied (each interaction = one navigation).
- RSC payload stays small: cards ship text + URLs, no inline styles per card
  beyond preview composition classes.
- Budget per UI_PERFORMANCE_CHECKLIST; measured at validation time (console/
  network clean, no 4xx, overflow-free at all widths).

## 9. Image strategy

- MVP has no production template assets yet, and production templates must be
  original or commercially licensed (sourcing rule — outside this task's code).
- Contract models preview as **optional**: `previewImage?: { src, alt }`.
  When absent, the card renders a **CSS-composed preview** (reusing the landing
  page's `invitation-preview-card` approach, extended with per-template theme
  tokens: palette + serif/sans character) so the grid is never broken images.
  CSS previews are `aria-hidden` decoration; the name/category text carries the
  meaning (same pattern already axe-clean on the landing page).
- When real assets exist: `next/image`, 3:4 reserved box (no CLS), AVIF/WebP,
  `priority` only on the first row, `sizes` tuned to grid columns; lazy below fold.
- Card preview aspect is identical in skeleton, CSS fallback, and real image.

## 10. Exact files and tests

Files to create:
- `apps/customer-web/src/app/templates/page.tsx` — route, metadata, searchParams
  parsing (Zod), composition
- `apps/customer-web/src/app/templates/loading.tsx` — skeleton grid
- `apps/customer-web/src/app/templates/error.tsx` — retry state
- `apps/customer-web/src/app/templates/catalog.css` — `ctlg-*` scoped styles
- `apps/customer-web/src/components/catalog/catalog-contract.ts` — Zod schema:
  `CatalogTemplate { id, name, category, tier, priceIdr, designCharacter,
  previewImage? , status: "ACTIVE", ... }` + `CatalogQuery` parse helper
- `apps/customer-web/src/components/catalog/catalog-data.ts` — fixture dataset
  (only ACTIVE statuses; original placeholder designs; realistic Indonesian
  template names/characters)
- `apps/customer-web/src/components/catalog/catalog-filters.tsx` — GET form +
  drawer variant
- `apps/customer-web/src/components/catalog/active-filter-tokens.tsx`
- `apps/customer-web/src/components/catalog/template-card.tsx`
- `apps/customer-web/src/components/catalog/catalog-results.tsx` — filter/sort/
  search application + list rendering

Files to extend (tests — all pre-existing specs keep passing):
- `tests/e2e/catalog.spec.ts` — add: filters reflected in URL; search empty state;
  "Hapus semua" works; sort default visible; card CTAs (demo + select) present
  and href-correct; core-feature parity copy present; no ratings/scarcity markers
- `tests/responsive/catalog.responsive.spec.ts` — add 320 + 1024 widths, filter
  drawer open-state overflow check
- `tests/accessibility/catalog.a11y.spec.ts` — add axe on filtered state and
  drawer-open state

Out of scope / owned elsewhere: template detail page (MVP-UI-004), demo route
(MVP-UI-009), real API, auth-gated favorites.

## Open decisions (need your call before coding)

1. **Tier labels** — propose three, craft-language only:
   "Sederhana" / "Klasik detail" / "Eksklusif" (descriptive of visual complexity,
   no functional implication). Alternative: two tiers only.
2. **Sort default** — propose "Terbaru" (fixture order = newest first).
3. **Favorites** — recommend skipping (rationale in §1); confirm.
4. **"Pilih desain" target** — no detail route exists yet (MVP-UI-004). Propose:
   link to `/templates/{id}` which 404s until MVP-UI-004 (same accepted pattern as
   `/demo`), OR disable with tooltip. Recommend the link (journey is honest, next
   task fills it).
