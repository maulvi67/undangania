# Agent Handoff — MVP-UI-002 Landing Page

**Task ID:** MVP-UI-002 (Landing Page, production)
**From/To agent:** UI implementation agent → next agent (catalog owner / MVP-UI-003)
**Status:** Code complete, validated, CONDITIONAL APPROVE (see UI quality decision)

## Objective

Production landing page for the Indonesian digital wedding invitation platform
(app: `customer-web`, route `/`). Bahasa Indonesia copy, no invented social proof,
primary CTA → `/templates`, secondary CTA → `/demo`.

## Context read

- AGENTS.md, PROJECT_CONTEXT.md, CODEBASE_MAP.md
- docs/UI_UX_QUALITY_STANDARD.md, docs/domains/* (invitation-template, pricing-package, template-customization)
- docs/checklists/ACCESSIBILITY_CHECKLIST.md, RESPONSIVE_CHECKLIST.md, UI_PERFORMANCE_CHECKLIST.md
- .ai/tasks/MVP-UI-002-LANDING-PAGE.md
- Skills: understand-codebase, impact-analysis, ui-ux-brief, implementation-plan,
  accessibility-audit, responsive-layout-audit, ui-performance-audit, ui-quality-gate

## Decisions

- Editorial visual thesis: hairline rules, serif display type, no gradients; brand "Wedding System".
- Fully static Server Component page (no client JS shipped for the page itself);
  `Drawer` in header is the only client island via `@wedding/ui`.
- CSS-composed illustrative template previews (no fabricated product screenshots);
  footer note discloses previews are illustrative.
- FAQ uses native `details/summary` (works without JS); FAQPage JSON-LD; WebSite JSON-LD.
- Primary CTA "Lihat koleksi desain" → `/templates`; secondary "Lihat demo undangan lengkap" → `/demo`.
- Pricing copy is amount-free (final prices live in the catalog, MVP-UI-003).
- **Open (needs PM confirmation):** invitation active period copy
  "hingga 30 hari setelah tanggal acara" in `pricing-explanation.tsx` (`INVITATION_ACTIVE_PERIOD`,
  marked `TODO(product)`). It is the proposed default, not a confirmed product policy.

## Files changed

Created:
- `apps/customer-web/next.config.ts` (transpilePackages `@wedding/ui`)
- `apps/customer-web/src/app/landing.css` (all `lnd-*` styles, reduced-motion-safe)
- `apps/customer-web/src/components/marketing/` — `link-button.tsx`, `marketing-header.tsx`,
  `marketing-footer.tsx`, `hero.tsx`, `value-props.tsx`, `how-it-works.tsx`,
  `featured-templates-data.ts`, `featured-templates.tsx`, `invitation-preview-card.tsx`,
  `core-features.tsx`, `pricing-explanation.tsx`, `trust-section.tsx`, `faq-section.tsx`,
  `final-cta.tsx`
- `tests/e2e/landing.spec.ts` (9 tests × 4 engines)
- `tests/responsive/landing.responsive.spec.ts` (9 widths × 4 engines)
- `.ai/handoffs/MVP-UI-002/` (this report, evidence.txt, screenshots, collect-evidence.mjs)

Modified:
- `apps/customer-web/src/app/page.tsx` (full landing composition + Metadata + JSON-LD)
- `apps/customer-web/src/app/layout.tsx` (imports ui tokens.css, ui.css, landing.css)
- `apps/customer-web/package.json` (add `@wedding/ui` dep)
- root `package.json` (add devDep `@axe-core/playwright` ^4.10.2)
- `packages/ui/src/field.tsx` — **pre-existing typecheck failure fixed**: `id` made required,
  label/messages helper params widened with `| undefined` (exactOptionalPropertyTypes).
  Necessary because customer-web compiles the ui package source; failure predated this task.

## Schema/API/event changes

None. Static marketing page; no data access.

## Security/privacy impact

None. No PII, no auth, no external calls. External input: none (static). Canonical/OG
metadata uses `NEXT_PUBLIC_SITE_URL` env fallback `http://localhost:3000`.

## Commands/tests/results

- `npm run typecheck` — 19/19 tasks pass
- `npm test` — 25/25 tasks pass (`@wedding/ui` 8/8)
- `npm run build -w @wedding/customer-web` — success; `/` fully static (prerendered)
- `npx playwright test tests/e2e/landing.spec.ts tests/responsive/landing.responsive.spec.ts`
  — **36/36 pass** across mobile (Pixel 7), chromium, firefox, webkit
- Browser evidence (chromium, `collect-evidence.mjs`, see `evidence.txt`):
  - Zero horizontal overflow at 320/375/390/768/1024/1440 and 640px (200% zoom equivalent)
  - Reduced motion: `.lnd-faq__chevron` transitionDuration `0s`; FAQ toggle still functional
  - Keyboard tab order (1440px): skip link → brand → 4 nav links → header CTA → hero CTAs →
    featured CTA → FAQ summaries (logical, DOM order)
  - Mobile drawer (375px): focus moves inside `dialog` on open; Escape closes; focus returns
    to the Menu trigger
  - Console errors: none. Network failures/4xx+: none.
- Test fixes during validation (test bugs, not page bugs):
  - FAQ test asserted a descendant `group`; `<details>` itself carries the implicit group
    role → now asserts `.lnd-faq__answer` visibility.
  - WebKit excludes plain links from default Tab order (Safari semantics) → skip-link test
    focuses the link directly on webkit; strict first-stop assertion kept for other engines.

## Generated artifacts

`evidence.txt`, `collect-evidence.mjs`, screenshots: `landing-{320x568,375x667,390x844,
768x1024,1024x768,1440x900}.png`, `landing-375x667-drawer.png` (this directory).

## Unresolved risks

1. **PM confirmation needed:** active-period copy (30 days after event date) — proposed default.
2. `/demo` and `/templates` are 404 until MVP-UI-009 / MVP-UI-003 land (landing links to them).
3. Repo test-wiring gap (pre-existing, out of file boundary): `tests/accessibility/` and
   `tests/responsive/` are outside the root playwright `testDir` (`tests/e2e`), and no
   `test:responsive` script exists; they must be run by explicit path.
4. Template previews are CSS illustrations; production template imagery is a catalog concern.

## Blockers

None for this task.

## Approvals

Design plan approved by user (previous session). No high-risk change triggered.

## Precise next action

MVP-UI-003: implement the approved catalog design at `/templates` (design doc delivered,
awaiting user approval to code).

## Rollback notes

Revert the files listed above. `packages/ui/src/field.tsx` fix should be kept (it fixes a
pre-existing typecheck failure); reverting it would break the ui typecheck gate.
