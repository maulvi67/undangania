# MVP-UI-008 Guided Invitation Editor Handoff

Status: IMPLEMENTED — browser UI quality gates complete; CONDITIONAL APPROVAL for production

## Task and objective

- Task: `.ai/tasks/MVP-UI-008-INVITATION-EDITOR.md`
- Objective: enable a non-technical wedding owner/editor to configure a polished
  invitation through structured forms and live preview.
- Approved plan: `.ai/handoffs/MVP-UI-008-DESIGN-PLAN.md`
- User direction was followed during implementation; the requested Playwright and
  specialized UI quality audit was run after development completion.

## Requirement coverage

Implemented the approved guided editor flow:

- `/editor` route with allowlisted fixture, invitation, template, and section
  query parameters;
- couple, events, venue/map, cover media, story, gallery, music, gift, FAQ,
  visibility, limited ordering, and invitation settings sections;
- desktop section navigation + form + live phone/desktop preview;
- mobile form-first layout with explicit dialog preview;
- saved, saving, dirty, save-failed, offline, stale-version,
  invalid-section, upload processing/rejected/ready, provider unavailable,
  entitlement limit, unauthorized, locked, and local recovery states;
- publication readiness panel that links each issue back to the relevant section;
- explicit stale-version conflict choices;
- media MIME/size preflight and visible upload state;
- safe incomplete-draft preview behavior;
- no drag-only ordering, arbitrary HTML, customer CSS, customer JavaScript,
  fake publication success, payment logic, or snapshot mutation.

## Architecture impact

- Added the canonical section payload and manifest ordering fields additively to
  `@wedding/template-engine`.
- Added manifest-aware reorder operations to `@wedding/template-editor`.
- Added a customer-web editor DTO boundary that converts validated structured
  draft content into `InvitationViewModel`.
- Added a client editor orchestrator with debounced autosave and section-level
  stale merge.
- The route remains a Next.js Server Component for initial loading; the editor
  workspace is the intentionally bounded client island.
- Existing Undangania tokens and `@wedding/ui` primitives are reused.
- No direct database access was added.

## Schema/API/event changes

No database schema, production API, webhook, payment, or publication endpoint
was added.

Contracts changed:

- `InvitationViewModel` now carries structured couple/event fields and typed
  section payloads.
- `TemplateManifest` now supports `requiredSections`,
  `reorderableSections`, and `sectionOrder`; arrays are readonly at the public
  type boundary.
- Customer-web editor contracts model structured draft sections, publication
  issues, media states, save actions, preview messages, and recovery drafts.
- `apps/customer-web/src/lib/editor/stub-transport.ts` is a deterministic
  simulation only and is not a production API.

## Security and privacy impact

Positive controls:

- editor inputs are schema-bounded; arbitrary HTML/CSS/JS is not accepted;
- preview receives a validated DTO rather than a database model;
- map URLs are limited to HTTP(S);
- theme values are allowlisted enums;
- music is URL-only with no autoplay;
- gift/contact values are not sent to telemetry by this implementation;
- stale saves do not silently overwrite newer server state;
- localStorage is recovery-only and clearly labelled as non-authoritative;
- the route has `robots: { index: false, follow: false }`.

Production blockers:

- the simulation transport has no session, tenant isolation, resource
  authorization, repository, persistence, signed uploads, provider checks, or
  server-side entitlement enforcement;
- production media upload must use signed URLs and validated provider/media
  state;
- production stale-version checks must be enforced server-side;
- gift values require an explicit privacy/telemetry review before any analytics
  integration;
- publication must continue to use immutable publication snapshots and an
  explicit publish/republish command.

## Exact files changed

### Modified

- `apps/customer-web/package.json`
- `packages/template-engine/src/index.ts`
- `packages/template-editor/src/index.ts`

### Added

- `apps/customer-web/src/app/editor/page.tsx`
- `apps/customer-web/src/app/editor/loading.tsx`
- `apps/customer-web/src/app/editor/error.tsx`
- `apps/customer-web/src/app/editor.css`
- `apps/customer-web/src/components/editor/editor-shell.tsx`
- `apps/customer-web/src/components/editor/editor-header.tsx`
- `apps/customer-web/src/components/editor/section-navigation.tsx`
- `apps/customer-web/src/components/editor/editor-form.tsx`
- `apps/customer-web/src/components/editor/editor-section-status.tsx`
- `apps/customer-web/src/components/editor/save-status.tsx`
- `apps/customer-web/src/components/editor/publication-readiness.tsx`
- `apps/customer-web/src/components/editor/editor-preview.tsx`
- `apps/customer-web/src/components/editor/mobile-preview-dialog.tsx`
- `apps/customer-web/src/components/editor/device-preview.tsx`
- `apps/customer-web/src/components/editor/stale-version-panel.tsx`
- `apps/customer-web/src/components/editor/provider-state.tsx`
- `apps/customer-web/src/components/editor/upload-state.tsx`
- `apps/customer-web/src/components/editor/sections/section-couple.tsx`
- `apps/customer-web/src/components/editor/sections/section-events.tsx`
- `apps/customer-web/src/components/editor/sections/section-venue.tsx`
- `apps/customer-web/src/components/editor/sections/section-cover.tsx`
- `apps/customer-web/src/components/editor/sections/section-story.tsx`
- `apps/customer-web/src/components/editor/sections/section-gallery.tsx`
- `apps/customer-web/src/components/editor/sections/section-music.tsx`
- `apps/customer-web/src/components/editor/sections/section-gift.tsx`
- `apps/customer-web/src/components/editor/sections/section-faq.tsx`
- `apps/customer-web/src/components/editor/sections/section-visibility.tsx`
- `apps/customer-web/src/components/editor/sections/section-order.tsx`
- `apps/customer-web/src/components/editor/sections/section-settings.tsx`
- `apps/customer-web/src/lib/editor/contract.ts`
- `apps/customer-web/src/lib/editor/contract.test.ts`
- `apps/customer-web/src/lib/editor/autosave-state.ts`
- `apps/customer-web/src/lib/editor/autosave-state.test.ts`
- `apps/customer-web/src/lib/editor/stale-merge.ts`
- `apps/customer-web/src/lib/editor/stale-merge.test.ts`
- `apps/customer-web/src/lib/editor/preview-contract.ts`
- `apps/customer-web/src/lib/editor/preview-contract.test.ts`
- `apps/customer-web/src/lib/editor/media-contract.ts`
- `apps/customer-web/src/lib/editor/media-contract.test.ts`
- `apps/customer-web/src/lib/editor/draft-store.ts`
- `apps/customer-web/src/lib/editor/draft-store.test.ts`
- `apps/customer-web/src/lib/editor/stub-transport.ts`
- `apps/customer-web/src/app/api/editor/route.ts`
- `packages/template-engine/src/index.test.ts`
- `packages/template-editor/src/index.test.ts`
- `tests/e2e/editor-audit.spec.ts`
- `tests/accessibility/editor.a11y.spec.ts`
- `tests/responsive/editor.responsive.spec.ts`
- `tests/performance/editor.performance.spec.ts`

The repository already contained uncommitted onboarding, dashboard, auth, and
previous UI work. It was preserved and not reverted.

## Validation evidence

### Static, unit, and build validation

Passed:

- `npm run typecheck -w @wedding/template-engine`
- `npm run typecheck -w @wedding/template-editor`
- `npm run typecheck -w @wedding/customer-web`
- `npm test -w @wedding/customer-web`
  - 13 test files passed
  - 112 tests passed
- `npx eslint` for changed customer-web editor/API files
- `npx eslint` for the four editor audit specs
- `npx prettier --check` for changed implementation and audit files
- `npm run build -w @wedding/customer-web`
  - production build passed
  - `/api/editor` and `/editor` are dynamic routes
- `git diff --check`
- file diagnostics for the changed shell, API route, and transport: no errors or
  warnings

The repository-root ESLint command still reports the known unrelated
`no-html-link-for-pages` configuration error because this app uses the App Router;
changed editor files pass the app-scoped lint command.

### Browser interaction matrix

Command:

```text
npx playwright test tests/e2e/editor-audit.spec.ts --project=chromium --project=firefox --project=webkit --workers=1 --reporter=line
```

Result: **36/36 passed**.

Covered at 375 px and 390 px in Chromium, Firefox, and WebKit:

- edit couple names;
- add three events;
- long venue and address content;
- add/remove optional story section;
- validation errors;
- save failure;
- stale-version merge choice;
- valid/invalid uploads;
- desktop/phone preview switch;
- mobile preview dialog and Escape focus return;
- refresh after save;
- keyboard traversal and skip link;
- reduced motion;
- console, page-error, request-failure, HTTP-error, overflow, CLS, and layout
  evidence.

### Specialized UI quality gates

Dedicated specs:

- `tests/accessibility/editor.a11y.spec.ts`: 6/6 per Chromium, Firefox, and
  WebKit; serious/critical axe violations: none.
- `tests/responsive/editor.responsive.spec.ts`: 11/11 per Chromium, Firefox,
  and WebKit at 320, 360, 375, 390, 412, 768, 1024, 1280, 1440, long content,
  and landscape.
- `tests/performance/editor.performance.spec.ts`: 4/4 per Chromium, Firefox,
  and WebKit at 375, 390, 768, and 1440.

Final evidence is stored under:

- `.ai/handoffs/MVP-UI-008/browser-audit/playwright-results-final/`
- `.ai/handoffs/MVP-UI-008/browser-audit/a11y-*-final/`
- `.ai/handoffs/MVP-UI-008/browser-audit/responsive-*-final/`
- `.ai/handoffs/MVP-UI-008/browser-audit/performance-*-final/`
- `.ai/handoffs/MVP-UI-008/browser-audit/runtime-metrics.json`
- `.ai/handoffs/MVP-UI-008/browser-audit/customer-web.stdout.log`
- `.ai/handoffs/MVP-UI-008/browser-audit/customer-web.stderr.log`

### Runtime and performance summary

The Next.js dev app was inspected through the visible `Open Next.js Dev Tools`
control. The final runtime capture found zero console errors, page errors,
request failures, or HTTP errors in all 12 engine/viewport samples. All samples
returned HTTP 200, had no horizontal overflow, and recorded CLS `0` with zero
layout-shift entries. Observed LCP ranged from 384 ms to 1,594 ms in this local
lab run; Chromium recorded two long tasks per sample and Firefox/WebKit recorded
zero. These are local lab measurements, not field p75 evidence.

### Screenshots and regression fixes

Representative screenshots and state screenshots are retained in the final
Playwright result folders. Browser testing found and fixed:

- overlong venue/address drafts crashing renderer DTO parsing; previews now clamp
  transient values and readiness reports `EVENT_FIELD_TOO_LONG`;
- client-only simulation saves being lost after refresh; browser saves now use the
  schema-validated simulation `/api/editor` boundary and a dev-process shared
  store;
- WebKit mobile focus being left behind the sticky preview action; the editor
  now scrolls focused form controls clear of sticky UI.

The API/store changes remain explicitly simulation-only and do not provide
production persistence, authorization, tenant isolation, signed uploads, or
provider integration.

## Migration and rollback

- No database migration required.
- No production API migration required.
- Rollback is file-level: remove the `/editor` route/components and editor
  contracts, revert the additive template-engine/template-editor contract
  changes, and remove the two workspace package dependencies if no later task
  uses them.
- Do not delete the canonical contract extension if another task has adopted
  it; coordinate with the Template Engine owner first.

## Known risks and blockers

1. The editor is fixture-backed and must not be enabled for real customer data.
2. The simulation has no tenant/session/authorization/persistence boundary.
3. Upload completion is local simulation; there is no signed upload or malware/
   provider pipeline.
4. Preview is in-process; the typed cross-document preview protocol is defined
   but not currently exercised by an iframe.
5. The browser evidence is fixture-backed and does not prove production
   repository, authorization, upload, or provider behavior.
6. Full-app lint still reports the unrelated pre-existing
   `no-html-link-for-pages` App Router configuration error; changed editor files
   are clean under app-scoped lint.
7. Runtime performance measurements are local lab data; field RUM/p75 is not
   configured by this task.
8. Existing customer-web package/package-lock changes from prior tasks remain
   uncommitted and should be reviewed together before release.

## Final quality decision

**CONDITIONAL APPROVAL — development implementation complete.**

The approved editor UX, structured contract, autosave/conflict logic, preview,
section forms, responsive behavior, accessibility checks, cross-engine browser
matrix, runtime inspection, and local performance evidence are complete. The
feature remains **conditionally approved**, not production-ready, because the
current transport is intentionally fixture-backed and lacks the real
tenant-scoped repository/API, server authorization, signed media upload path,
server-side entitlement enforcement, provider checks, and publication integration.

## Precise next action

Replace `apps/customer-web/src/lib/editor/stub-transport.ts` and the audit-only
`apps/customer-web/src/app/api/editor/route.ts` path with a tenant-scoped
application/API provider that loads and saves invitation drafts under session and
resource authorization, enforces optimistic versioning and entitlements
server-side, persists media through signed uploads, and preserves immutable
publication snapshots. Then rerun the same browser gates against the authorized
provider before changing the decision to APPROVE.
