# MVP-UI-009 Kenanga Renderer Addendum

## Outcome

Added the public renderer for the active `kenanga-tradisi@1` catalog template. It uses the in-repository blush/clay palette, serif display type, framed cover, and restrained antique-gold details. The renderer reuses the shared invitation composition and only renders manifest-supported sections.

## Files changed

- `apps/customer-web/src/components/public-invitation/seruni-template.tsx` — Kenanga manifest, composition wrapper, and renderer.
- `apps/customer-web/src/components/public-invitation/registry.tsx` — registers Seruni, Nara, and Kenanga.
- `apps/customer-web/src/lib/public-invitation/fixtures.ts` — synthetic `rani-bima-kenanga` publication.
- `apps/customer-web/src/app/invite/[slug]/page.tsx` — selects Kenanga's scoped page theme.
- `apps/customer-web/src/app/golden-invitation.css` — Kenanga-specific theme and guest-form styling.
- `apps/customer-web/src/components/public-invitation/seruni-template.test.tsx` — updated existing renderer-list expectation. No test case was added.
- `.ai/reports/MVP-UI-009-kenanga-desktop.png`
- `.ai/reports/MVP-UI-009-kenanga-mobile.png`

## Architecture and safety

- No API, database schema, migration, payment, or authentication changes.
- The public renderer uses the validated canonical view model and existing publication repository boundary.
- The fixture contains synthetic names and no externally sourced media, fonts, scripts, or template source.
- Rollback by removing Kenanga's renderer/manifest, registry entry, fixture, scoped CSS, assertion update, and screenshots.

## Verification

- `npm run typecheck -w @wedding/customer-web` — passed.
- `npm test -w @wedding/customer-web` — passed: 37 files, 260 tests. No test case was added.
- `npm run build -w @wedding/customer-web` — passed.
- Prettier check on changed source — passed.
- Manual Chromium render of `/invite/rani-bima-kenanga` returned HTTP 200 with the expected theme classes and no page/runtime or failed-request errors. Desktop and mobile screenshots are attached.

## Release status

This completes renderer coverage for the three templates currently marked `ACTIVE`. It does not constitute MVP release approval: purchase, verified payment, provisioning, tenant isolation, and cross-browser/UI release gates still require consolidated evidence. Do not change authentication/session, authorization, payment/webhook/refund, production infrastructure, or secrets without explicit approval.
