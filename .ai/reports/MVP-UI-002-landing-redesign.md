# MVP-UI-002 Landing redesign handoff

Status: visual implementation delivered; release approval remains pending.

## Design decisions

- Use a warm ivory canvas (`#FCF7F5`), soft blush surfaces (`#F3E5E8`), deep berry text (`#3D2932`), rose actions (`#91475D`), and antique-gold details (`#C3A36B`).
- Keep existing self-hosted Fraunces and Instrument Sans fonts; add no dependency or remote asset.
- Keep the hero editorial and split on desktop. Arrange real catalog templates in an asymmetric portfolio grid. Stack the layout on mobile.
- Keep trust copy factual. Add no testimonials, ratings, or fabricated statistics.

## Files

- `apps/customer-web/src/app/landing.css` — page-scoped palette, ambient color, section surface, and responsive portfolio grid.
- `apps/customer-web/src/components/marketing/hero.tsx` — concise, personal hero headline.
- `tests/e2e/landing.spec.ts` — updated hero-copy expectation.
- `.ai/reports/MVP-UI-002-landing-desktop.png` — desktop hero screenshot.
- `.ai/reports/MVP-UI-002-landing-gallery.png` — desktop template gallery screenshot.
- `.ai/reports/MVP-UI-002-landing-mobile.png` — mobile hero screenshot.

## Impact and safety

- Server Component structure and existing catalog data remain unchanged.
- No schema, API, domain, payment, authentication, tenant, or data-retention changes.
- No customer PII was added. Sample invitation content remains labeled and hidden from assistive technology.
- No migration or rollback procedure is needed. Revert the listed UI, test, and evidence files to roll back.

## Validation

- `npm run validate:repo` — passed before edits.
- Root `npm run typecheck` — passed before edits; `npm run typecheck -w @wedding/customer-web` passed after edits.
- `npm test -w @wedding/customer-web` — passed after edits.
- `npm run build -w @wedding/customer-web` — passed after edits.
- `npm run lint -w @wedding/customer-web` — zero errors; two warnings in untouched files (`seruni-template.tsx` image optimization and `contract.test.ts` unused variable).
- Prettier checks and `git diff --check` — passed.
- Chromium smoke check against the built app — HTTP 200; catalog CTA visible and no horizontal overflow at 320, 360, 375, 390, 412, 768, 1024, 1280, and 1440px; keyboard skip link and FAQ interaction passed; axe found no critical or serious violations.
- Playwright test discovery passed for landing E2E and responsive specs. Full configured suites were not run.
- The initial root validation chain timed out at 240 seconds during root `npm test`, after root typecheck passed. Root-wide tests and build remain unverified.

## Outstanding release gates

`.ai/tasks/MVP_UI_TASK_INDEX.csv` still lists MVP-UI-000, MVP-UI-001, and MVP-UI-002 as `NOT STARTED`. The task sequence requires the earlier baseline and design-system gates before landing-page approval. Complete those gates, run the full browser suites, and obtain required review before marking MVP-UI-002 complete.
