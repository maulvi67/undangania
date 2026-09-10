# Agent Handoff — MVP-UI-003 Template Catalog

**Task ID:** MVP-UI-003 (Template catalog)
**From/To agent:** UI implementation agent → next agent (template detail MVP-UI-004 / auth MVP-UI-005)
**Status:** Complete; all gates passed at implementation time (retrospective report — see note)

> Note: this report was written retrospectively after MVP-UI-005; the implementation,
> validation runs, and fixes described below happened during the MVP-UI-003 session.

## Objective

`/templates` catalog: template grid, search, category filter, price-tier filter, sort,
preview, clear price display, design character, core-feature parity explanation, demo
CTA, select CTA, empty/loading/error states, mobile filter pattern — the customer
chooses confidently in under three minutes.

## Context read

Task file MVP-UI-003; template domain rules; Template Engine contracts; design
system + landing patterns; skills: understand-codebase, impact-analysis, ui-ux-brief,
implementation-plan.

## Decisions

- **Core-feature parity is the headline constraint:** every card and the tier filter
  surface "semua level harga memiliki fitur inti yang sama"; price differences are
  framed as visual design / asset complexity only. No feature badges stacked on cards.
- **Server-driven query state** (single GET form): search, category, tier, sort all
  live in URL params — shareable, back-button correct, no client state.
- **Mobile filters use native `<details>`**, not the UI Drawer — the single-GET-form
  constraint (one form per page) ruled out the portal-based Drawer. Desktop shows the
  open filter column; mobile collapses to a summary.
- **No favorites/shortlist in MVP** — not justified without an account to persist to
  (auth did not exist yet); noted as a candidate once auth lands.
- Active-filter tokens show each applied filter with a remove action.
- Empty search state offers "Hapus semua filter"; error/empty-collection state offers
  "Kembali ke beranda".
- No fake scarcity, no fake ratings, no sales counters anywhere.
- Suspense/streaming skeleton skipped: the catalog is a single fast server render
  from local fixtures; a loading state would add complexity without a real slow path.

## Files changed (created)

- `apps/customer-web/src/components/catalog/catalog-query.ts` + `catalog-query.test.ts`
  (parse/apply/hasActiveFilters, 19 unit tests)
- `.../catalog-filters.tsx`, `.../catalog-results.tsx`, `.../active-filter-tokens.tsx`
- `apps/customer-web/src/app/catalog.css`
- `apps/customer-web/src/app/templates/page.tsx` (server, JSON-LD ItemList)
- `tests/e2e/catalog.spec.ts`, `tests/accessibility/catalog.a11y.spec.ts`,
  `tests/responsive/catalog.responsive.spec.ts`
- `tests/playwright.config.ts` — **repo gap fix:** the root config's `testDir:
  tests/e2e` silently excludes the accessibility/responsive directories even when
  passed explicitly (Playwright only filters within testDir); this config exists so
  `npx playwright test --config tests/playwright.config.ts accessibility/ responsive/`
  actually runs those suites. Keep using it.

Modified: none outside new files.

## Schema/API/event changes

None (local fixture data via template-data.ts from MVP-UI-004 contracts).

## Security/privacy impact

None — public marketing page, no PII, no tenant data.

## Commands and results (at implementation time)

- typecheck, unit (catalog-query 19/19), build, lint — **pass**
- E2E (4 projects): **112/112 pass**
- Accessibility + responsive (4 projects): **168/168 pass** — 2 Firefox axe timeouts
  under full 8-worker load were load flake, re-verified green when the project ran solo
- Performance (`/templates`): TTFB 33–54ms, CLS 0.000, 10 requests, 137KB JS /
  6.2KB CSS — within the /templates-derived budget
- 3 pre-existing lint errors in MVP-UI-002/004 files were flagged, **not** fixed
  (out of scope)

## Known risks / unresolved

1. Fixture pricing remains placeholder (TODO(product)).
2. Mobile filter pattern is functional but less polished than a Drawer; revisit if
   the single-form constraint is lifted.
3. See MVP-UI-004 handoff for the `/daftar` CTA contract (resolved by MVP-UI-005).

## Next action

Completed; the next catalog increment (pagination/virtualization, real asset
pipeline) waits on production template sourcing.
