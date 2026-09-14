# MVP-UI-009 Golden Public Invitation

## Decision

**APPROVE** — implementation complete for the original CSS-only Seruni golden template. The template-create, publication-snapshot, public-invitation-performance, accessibility, responsive-layout, and UI-performance gates are complete for the fixture-backed MVP boundary. The browser evidence is recorded below; the production publication API remains a required follow-up before real invitations are exposed.

## Files changed

- `apps/customer-web/src/lib/public-invitation/fixtures.ts` — immutable fixture-backed publication snapshots and required content variants.
- `apps/customer-web/src/lib/public-invitation/fixtures.test.ts` — canonical model and fixture coverage.
- `apps/customer-web/src/components/public-invitation/countdown.tsx` — timezone-aware client countdown with no external dependencies.
- `apps/customer-web/src/components/public-invitation/seruni-template.tsx` — pure renderer for `seruni-klasik@1`.
- `apps/customer-web/src/components/public-invitation/registry.tsx` — template registry and publication snapshot boundary.
- `apps/customer-web/src/components/public-invitation/seruni-template.test.tsx` — manifest, registry, model-boundary tests.
- `apps/customer-web/src/app/invite/[slug]/page.tsx` — synthetic public snapshot route.
- `apps/customer-web/src/app/invite/[slug]/not-found.tsx` — safe missing-invitation state.
- `apps/customer-web/src/app/golden-invitation.css` — original responsive Seruni theme.
- `tests/e2e/public-invitation.spec.ts` — public invitation behavior and failure checks.
- `tests/accessibility/public-invitation.a11y.spec.ts` — axe and keyboard checks.
- `tests/responsive/public-invitation.responsive.spec.ts` — required viewport checks.
- `tests/performance/public-invitation.performance.spec.ts` — request, reduced-motion, and layout checks.
- `.ai/handoffs/MVP-UI-009/PROVENANCE.md` — source and asset approval record.
- `.ai/handoffs/MVP-UI-009/browser-audit/` — browser test metadata, screenshots, runtime evidence, and server logs.

## Requirement coverage

- Opening invitation: native `<details>` / `<summary>` interaction works without JavaScript.
- Couple identity: canonical couple fields.
- Events: all snapshot events, local date/time formatting, timezone labels.
- Maps: protocol-allowlisted links only.
- Countdown: client-only timezone-aware timer; no hydration-time clock mismatch.
- Story: optional and omitted when unavailable.
- Gallery: CSS-only bounded gallery fixture, including thirty-image variant.
- RSVP CTA: accessible in-page action; no unauthorised mutation endpoint invented.
- Gift: validated snapshot items only.
- Guestbook: validated snapshot items or honest empty copy.
- Closing: canonical couple identity and closing copy.

## Architecture/security impact

- No schema or API changes.
- No database/session/payment/raw guest-token/provider SDK imports in the renderer.
- The route is fixture-backed to avoid pretending the unimplemented public API exists; production API integration can pass the same `PublicationSnapshotInput` boundary.
- The renderer validates `InvitationViewModel` and checks template contract version before selecting the immutable registered version.
- The route is `noindex` because all included content is synthetic.

## Provenance

See `PROVENANCE.md`. Human approval was received before implementation. The theme has no external runtime assets or copied source.

## Validation evidence

### Static and unit validation

- `npm run typecheck -w @wedding/template-engine` — passed.
- `npm run typecheck -w @wedding/customer-web` — passed.
- `npm run test -w @wedding/template-engine` — passed.
- `npm run test -w @wedding/customer-web` — passed: 15 files, 122 tests.
- Focused renderer tests — passed: 10/10.
- `npm run build -w @wedding/customer-web` — passed.
- Scoped ESLint for the new implementation — passed.
- Full customer-web lint is not clean because three unrelated pre-existing files use internal raw anchors and fail `@next/next/no-html-link-for-pages`: `apps/customer-web/src/app/templates/[id]/page.tsx`, `apps/customer-web/src/components/marketing/featured-templates.tsx`, and `apps/customer-web/src/components/marketing/marketing-header.tsx`.

### Browser gates

- Behavioral E2E: Chromium 4/4, Firefox 4/4, WebKit 4/4.
- Accessibility: Chromium 4/4, Firefox 4/4, WebKit 4/4.
- Responsive: Chromium 11/11, Firefox 11/11, WebKit 11/11.
- Responsive coverage: 320x568, 360x800, 375x812, 390x844, 412x915, 768x1024, 1024x768, 1280x800, and 1440x900, plus long-content and 30-image fixtures.
- Performance: Chromium 2/2, Firefox 2/2, WebKit 2/2.
- Performance assertions: no failed/4xx requests, no console/runtime failures, zero image requests, zero audio requests, zero horizontal overflow, script count at or below 12, and reduced-motion durations at or below 0.001 seconds.
- Keyboard and progressive enhancement: skip-link/focus path, native details opening, FAQ expansion, RSVP anchor, and no-JavaScript invitation opening passed.
- Screenshot evidence: `.ai/handoffs/MVP-UI-009/browser-audit/screenshots/` contains normal, long-content, three-event, missing-optional, and large-gallery captures at 390px and 1440px, plus `evidence.json`.

### Runtime evidence

The capture evidence recorded no console errors, page errors, request failures, or HTTP errors for any fixture. All captured viewports had zero horizontal overflow and zero CLS. Warm captures reported LCP between 72ms and 140ms in the local production build, with 0–1 long tasks. The first normal 390px capture included a one-time local server warm-up (LCP 5304ms); this is an environment startup outlier, not a template rendering measurement. Resource evidence remained bounded at 13 resources, approximately 156 KB transfer, with no images or audio because the approved golden theme uses CSS-only assets.

### Specialized workflow coverage

- `template-create-validate`: provenance, manifest/model, content fixtures, accessibility, and performance evidence complete.
- `publication-snapshot-review`: immutable fixture snapshot boundary verified; renderer receives validated presentation data only and excludes guest context/provider access.
- `public-invitation-performance`: public route uses minimal client behavior, no preloaded media/audio, bounded CSS gallery tiles, and reduced-motion handling.
- `accessibility-audit`: automated serious/critical axe checks and manual keyboard/progressive-enhancement checks passed; this is not a claim of full WCAG conformance.
- `responsive-layout-audit`: required viewport and difficult-content fixtures passed without overflow or clipped primary content.
- `ui-performance-audit`: local lab evidence passed the applicable CLS and resource guards; field p75 LCP/INP is not measurable until production traffic exists.

## Migration/rollback

No migration. Roll back by removing the listed route, renderer, fixture, stylesheet, tests, and handoff files. Existing catalog/detail/editor work is independent.

## Known risks

- The public API and persisted publication snapshot loader are not implemented in this repository slice; the fixture route must be replaced by a tenant-safe API/application adapter before production publication.
- CSS gallery tiles are intentionally placeholders until approved customer-owned object-storage media is included in a validated publication snapshot.
- Countdown correctness depends on valid IANA timezone names supplied by the validated snapshot.
