# MVP-UI-009 Nara Renderer Addendum

## Outcome

Added a public renderer for the active `nara-modern@1` catalog template. Nara uses the catalog's paper palette, olive accent, sans-serif typography, and ornament-free layout. Its composition reuses the validated invitation sections and shared guest interactions without changing Seruni's appearance.

## Files changed

- `apps/customer-web/src/components/public-invitation/seruni-template.tsx` — shared composition, Nara manifest and renderer; unsupported sections are filtered by the selected manifest.
- `apps/customer-web/src/components/public-invitation/registry.tsx` — registers both renderers and validates each snapshot against its selected renderer's contract version.
- `apps/customer-web/src/lib/public-invitation/fixtures.ts` — synthetic Nara publication fixture at `rani-bima-nara`.
- `apps/customer-web/src/app/invite/[slug]/page.tsx` — applies Nara page theme from the selected snapshot.
- `apps/customer-web/src/app/golden-invitation.css` — Nara-scoped visual styles; Seruni styles remain unchanged.
- `apps/customer-web/src/components/public-invitation/seruni-template.test.tsx`
- `apps/customer-web/src/lib/public-invitation/fixtures.test.ts`
- `tests/e2e/public-invitation.spec.ts`
- `tests/accessibility/public-invitation.a11y.spec.ts`
- `tests/responsive/public-invitation.responsive.spec.ts`
- `.ai/reports/MVP-UI-009-nara-desktop.png`
- `.ai/reports/MVP-UI-009-nara-mobile.png`

## Architecture and safety

- No schema or API changes; no migration or rollback migration required.
- No database, session, payment, provider, or guest-token dependencies were added to the renderer.
- Fixture uses synthetic content only. No third-party images, fonts, audio, scripts, or copied template source were added.
- Nara and Seruni continue to render only validated `InvitationViewModel` data. Guest context remains outside the publication renderer.
- Rollback by removing the Nara renderer/manifest, registry entry, fixture, scoped theme, and associated tests/screenshots.

## Verification

- `npm run typecheck -w @wedding/customer-web` — passed.
- `npm test -w @wedding/customer-web` — passed: 37 files, 260 tests.
- `npm run build -w @wedding/customer-web` — passed.
- Prettier check on changed source and test files — passed.
- Scoped ESLint — zero errors; one existing `<img>` warning in Seruni and a root-level Next.js pages-directory configuration warning.
- Nara E2E and responsive Playwright cases reported passed. After fixing an initial Nara header contrast result (4.32:1), the Nara accessibility case also reported passed and a direct Chromium axe run returned no violations. The Playwright command did not exit before the tool timeout while shutting down its development server, so the browser-runner process exit is not verified.
- Screenshots were captured from the synthetic Nara fixture at desktop and mobile widths. The Next.js development toolbar was hidden only in the capture context.

## Remaining risks and next action

This is an incremental template slice, not MVP release approval. Public invitation data remains fixture-backed; the production publication API/tenant-safe loader and purchase-to-verified-payment-to-provisioning journey remain follow-ups. `kenanga-tradisi` remains marked active without a publication renderer.

Next, implement and verify the production publication read path and continue template coverage with Kenanga. Obtain explicit approval before changing authentication/session, authorization, payment/webhook/refund, or production infrastructure boundaries.
