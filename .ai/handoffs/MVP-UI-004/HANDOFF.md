# Agent Handoff — MVP-UI-004 Template Detail + Interactive Demo

**Task ID:** MVP-UI-004 (Template Detail and Interactive Demo)
**From/To agent:** UI implementation agent → next agent (catalog MVP-UI-003 / auth MVP-UI-005)
**Status:** Code complete, all gates pass, CONDITIONAL APPROVE (see decision)

## Objective

Detail page (`/templates/[id]`) + interactive demo (`/templates/[id]/demo`) answering the
seven primary customer questions before selection; `/demo` now redirects to the default
template demo (landing's secondary CTA is live).

## Context read

- MVP-UI-004, MVP-UI-009, MVP-UI-006 task files; domain docs (invitation-template,
  template-customization, pricing-package); template-engine manifest/registry;
  contracts package; skills: ui-ux-brief, implementation-plan (+ all audit skills earlier).

## Decisions

- **License/source:** all designs are original CSS compositions created in-repo —
  clean by construction; no external template sources. Production asset sourcing
  remains a catalog/pipeline concern.
- **CSS-only device switch** (native radios + `:has()`): keyboard operable, works
  without JavaScript, zero client JS. Phone is default (guests are mobile-first).
- **Theme = allowlisted tokens** (palette/accent/typeMood/ornament → composable CSS
  classes); never raw CSS from data (template-customization domain rule).
- **Demo:** separate route, synthetic content ("Rai & Anisa" — same illustrative
  couple as landing), clearly labeled "data contoh", noindex, renders only sections
  the manifest supports. Only interactive element: local-only RSVP form (validates,
  confirms; states "tidak dikirim ke mana pun"). No network, no persistence.
- **Sticky mobile bar:** `position: sticky` in flow + `scroll-padding-bottom` on html;
  validated that focused elements never sit behind the pinned bar (overlap test).
- **Select CTA → `/daftar`** — auth entry route not yet built (MVP-UI-005).
  **Open contract decision:** MVP-UI-005 must adopt `/daftar` or add a redirect.
- Fixture prices are placeholders (TODO(product)); active-period copy still the
  proposed default pending PM confirmation (from MVP-UI-002).

## Files changed

Created:
- `apps/customer-web/src/components/templates/template-contract.ts` (Zod contract,
  section allowlist + labels, formatIdr)
- `.../template-data.ts` (3 ACTIVE + 1 RETIRED fixtures, validated at module load)
- `.../template-contract.test.ts` (10 unit tests)
- `.../theme-classes.ts`, `.../device-preview.tsx`, `.../template-preview.tsx`,
  `.../sticky-select-bar.tsx`
- `.../demo/demo-invitation.tsx` (server, section-gated), `.../demo/rsvp-form.tsx` (client, local-only)
- `apps/customer-web/src/app/templates.css` (tpl-*/dmv-* styles)
- `apps/customer-web/src/app/templates/[id]/page.tsx` (detail; SSG + generateMetadata)
- `.../[id]/loading.tsx`, `.../[id]/not-found.tsx` (unknown/retired recovery)
- `apps/customer-web/src/app/templates/[id]/demo/page.tsx` (noindex, SSG)
- `apps/customer-web/src/app/demo/page.tsx` (redirect → default demo)
- `tests/e2e/template-detail.spec.ts` (13 tests), `tests/accessibility/template-detail.a11y.spec.ts`
  (4 axe states), `tests/responsive/template-detail.responsive.spec.ts` (13 checks)
- `.ai/handoffs/MVP-UI-004/` (this report, evidence.txt, collect-evidence.mjs, screenshots)

Modified: none outside new files.

## Schema/API/event changes

None. Fixture module behind a Zod contract designed to swap to the real catalog API.

## Security/privacy impact

No PII (demo data synthetic); RSVP demo form is local-only and labeled as such;
no external input accepted server-side beyond route params (validated against
contract-shaped fixture ids); no secrets; demo route noindex.

## Commands/tests/results

- `npm run typecheck` — 19/19; `npm test` — 25/25 (customer-web now 10 unit tests)
- `npm run build -w @wedding/customer-web` — all routes prerendered (SSG/static,
  demo separate from detail)
- Playwright (all 4 projects: mobile Pixel 7, chromium, firefox, webkit):
  **80/80 pass** — template-detail + landing regression (e2e + a11y + responsive)
- Browser evidence (chromium, `evidence.txt`): zero overflow 320→1440 + 200% zoom
  equivalent; device switch frame 532px desktop vs 360px phone; RSVP validation +
  success; retired/unknown recovery; `/demo` redirect; reduced motion
  `transitionDuration: 0s`; tab order logical; sticky bar never overlaps focused
  elements (overlap-rect test); console/network clean.
- Test fixes during validation (test bugs, not page bugs): strict-mode locators
  (price text appears in card + sticky bar; couple names in two headings); device
  width assertion → aspect-ratio (viewport-independent); sticky check was flagging
  elements *below* the bar in flow (footer) — corrected to true overlap test.

## Generated artifacts

`evidence.txt`, `collect-evidence.mjs`, screenshots: `detail-{320x568,375x667,390x844,
768x1024,1024x768,1440x900}.png`, `detail-1024x768-desktop.png`, `demo-{375x667,1440x900}.png`,
`demo-375x667-rsvp-success.png`, `retired-375x667.png` (this directory).

## Unresolved risks

1. Fixture prices placeholder — TODO(product).
2. Active-period copy (30 days) still pending PM confirmation (carried from MVP-UI-002).
3. `/templates` (catalog, MVP-UI-003) and `/daftar` (auth, MVP-UI-005) are 404 today —
   both are agreed next-task targets; back-to-catalog links point at `/templates`.
4. Preview media failure state: not exercised with real media (no production assets yet);
   CSS-composed previews cannot fail. Revisit when real assets land.
5. Visual screenshot review not possible in this session (no image support) — visual
   verdict rests on automated evidence + spec conformance.

## Blockers

None.

## Approvals

No high-risk change triggered (no auth/payment/tenant work). Human review points:
fixture pricing, `/daftar` route contract, active-period copy.

## Precise next action

MVP-UI-003 (catalog) remains designed-but-not-approved; its data layer can adopt
`components/templates/template-contract.ts` + `template-data.ts` as-is.

## Rollback notes

Revert all created files. No shared files modified, so rollback is clean.
