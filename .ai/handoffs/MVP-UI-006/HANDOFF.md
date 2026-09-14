# Agent Handoff — MVP-UI-006 Wedding Workspace Onboarding

**Task ID:** MVP-UI-006 (Wedding Workspace onboarding UI)
**From/To agent:** UI implementation agent → next agent (wedding-domain owner / editor MVP-UI-008)
**Status:** Code complete. Typecheck, unit (89/89), build, lint green; runtime smoke of `/mulai` (HTTP 200, clean server log). Browser suites excluded per user direction (D8) — see "Known risks". CONDITIONAL APPROVE (see decision below).

## Objective

3-step onboarding flow (`/mulai`: Mempelai → Acara pertama → Preferensi) for
`apps/customer-web`, per the user-approved design plan
`.ai/handoffs/MVP-UI-006-DESIGN-PLAN.md` (approved as-is, D1–D8). Goal metric:
customer starts editing in under 10 minutes — 9 required inputs (2 pre-filled
defaults: timezone WIB, locale id) across 3 short screens.

## Context read

Design plan (authoritative); `docs/domains/wedding-event.md`; MVP-UI-005 auth
implementation (route/language conventions, stub-transport precedent,
AuthShell, `noValidate` + server-action-as-validator pattern); MVP-UI-003/004
template catalog contracts (`getActiveTemplates`, event vocabulary); @wedding/ui
kit.

## Decisions (user-approved plan §12)

- **D1** Route `/mulai`; optional `?template=` validated against active
  templates server-side, invalid values silently ignored, forwarded to
  `/editor?template=` at completion (catalog → daftar → mulai → editor chain).
- **D2** Simulation layer ships: deterministic in-memory server store (stub
  transport) + client localStorage draft owning resume. Real `/weddings` API is
  the handoff artifact — Security/Tenancy gate before any real persistence.
- **D3** Future-only dates (today allowed as boundary) for wedding + event dates.
- **D4** Timezone grouped with city on step 2 ("where" answer), not preferences.
- **D5** Completion exits to `/editor` (contract target; 404 until MVP-UI-008,
  accepted pattern) + secondary `/templates`.
- **D6** Deterministic failure fixtures: city `gagal-simpan` → SAVE_FAILED;
  venue `versi-lama` → STALE_VERSION (documented in stub header).
- **D7** Bare names only (no honorifics); event types Akad Nikah, Resepsi,
  Unduh Mantu, Lainnya.
- **D8** Unit tests + manual QA only, no Playwright suites — per user standing
  direction ("focus on development, testing after development"; Playwright
  removed).

## Implementation deviations from plan (flagged)

1. **Enum validation in base schema.** `eventType`/`timezone`/`locale` use
   `z.enum` at the schema base (not superRefine) so `parsed.data` carries
   narrow types and can flow directly into typed `StepPatch` merges. Cost:
   a tampered enum short-circuits parallel superRefine errors for that step
   (only the enum error shows first). Unreachable from the UI — controlled
   selects with valid defaults always submit valid enums.
2. **Completed draft keeps data.** Plan said completion "clears the draft,
   keeps the marker"; implementation keeps fields in the stored draft
   (completed flag) so the returning "Persiapan sudah selesai" panel can render
   the read-only summary. [Isi ulang] clears it.
3. **FlowState `completed` carries `version`** (plus merged data) for the
   completion screen.
4. **Step components update via `Partial<OnboardingData>` patches**, not
   `(field, value)` pairs — TypeScript union-key writes are unusable under
   strict settings for heterogeneous records.
5. **No `min` attribute on date inputs** (plan listed min=today): a
   server-computed "today" string can hydration-mismatch across midnight.
   Server validation still rejects past dates; client relies on the same
   server action.

Fixes applied during validation (found by unit tests / lint — this session):

- `translateFieldErrors`: non-custom issues now map `too_big` → max-length
  message, everything else → required message (was: all non-custom →
  max-length, contradicting its own doc comment and the tested contract — a
  tampered enum showed "Pilih zona waktu." as intended now).
- `formatEventLine`/`formatWeddingDate` English rendering: `en-GB` day-first
  ("Saturday, 21 March 2026", consistent with id "Sabtu, 21 Maret 2026");
  was `en-US` month-first ("March 21, 2026").
- `react-hooks/set-state-in-effect` (Next core-web-vitals, React
  Compiler-era rule) fires on the mount-time draft restore. One justified
  `eslint-disable-next-line` with comment: the one-time localStorage read must
  happen post-hydration (a lazy `useState` initializer would mismatch SSR
  HTML), and React 18+ batches the restore setStates into one render. Codebase
  precedent: `no-control-regex` disable in `lib/auth/redirect.ts`.

## Files changed

All new; no existing file modified, `next.config` untouched.

```
apps/customer-web/src/lib/onboarding/contract.ts        Zod step schemas, error/message catalogs, FlowState, format helpers
apps/customer-web/src/lib/onboarding/contract.test.ts    31 unit tests
apps/customer-web/src/lib/onboarding/stub-transport.ts  ⚠️ SIMULATION ONLY (in-memory store, versioning, fixtures)
apps/customer-web/src/lib/onboarding/actions.ts         "use server": saveStepAction, completeAction, loadDraftAction
apps/customer-web/src/lib/onboarding/draft-store.ts     localStorage draft (injectable storage, SSR-safe, pure helpers)
apps/customer-web/src/lib/onboarding/draft-store.test.ts 7 unit tests
apps/customer-web/src/components/onboarding/onboarding-flow.tsx   client orchestrator (state machine, autosave, focus)
apps/customer-web/src/components/onboarding/onboarding-progress.tsx
apps/customer-web/src/components/onboarding/step-couple.tsx
apps/customer-web/src/components/onboarding/step-event.tsx
apps/customer-web/src/components/onboarding/step-preferences.tsx
apps/customer-web/src/components/onboarding/summary-card.tsx
apps/customer-web/src/components/onboarding/resume-banner.tsx
apps/customer-web/src/components/onboarding/save-status.tsx
apps/customer-web/src/app/mulai/page.tsx                server component (searchParams awaited, ?template= validated)
apps/customer-web/src/app/onboarding.css                onb-* scope, tokens only
```

## Schema/API/event changes

None shipped. `lib/onboarding/contract.ts` is the handoff artifact the
wedding-domain owner must implement against the real `/weddings` `/events`
`/venues` API (tenant-provisioned, authorized per step, server-owned
versions). Encoded requirements: server action is the single validator
(clients render `noValidate`); version-conflict semantics (`STALE_VERSION` +
force-overwrite path); error codes VALIDATION / STALE_VERSION / SAVE_FAILED /
UNAVAILABLE; per-step scoped validation; today-allowed future-only dates.

## Security/privacy impact

- **No real persistence.** Stub store is in-memory, resets on restart, carries
  no tenant/session. Replacing it is an AGENTS.md high-risk change
  (Security/Tenancy review + human approval).
- localStorage draft holds user-entered names/address on the customer's own
  device only; cleared by [Mulai baru] (inline confirm) and [Isi ulang];
  quota/private-mode failures are swallowed (never crash).
- No PII in URLs (`?template=` only); no cookies, sessions, or middleware
  added; no analytics on onboarding input.
- Fixture triggers documented in stub header (SIMULATION ONLY), same as auth.

## Commands and results

- `npm run typecheck -w @wedding/customer-web` — **pass** (after a 15-error fix
  round in session 1; re-run green after session-2 fixes)
- `npm test -w @wedding/customer-web` — **89/89 pass** (onboarding contract 31,
  draft-store 7, pre-existing 51: auth contract 12, redirect 9, catalog 19,
  template-contract 11). Two session-2 failures (translateFieldErrors mapping,
  en date order) diagnosed as implementation bugs and fixed — see deviations.
- `npm run build -w @wedding/customer-web` — **pass**; `/mulai` dynamic (ƒ),
  all pre-existing routes intact.
- `npx eslint src/lib/onboarding src/components/onboarding src/app/mulai`
  (from app cwd) — **0 errors/warnings** (one unused import removed; one
  justified rule disable, see deviations). 3 pre-existing lint errors live in
  MVP-UI-002/004 files — out of scope, untouched.
- Runtime smoke (dev-direction-compliant, no browser suite):
  `npm run start` + `curl /mulai` → **HTTP 200**; SSR HTML contains step-1
  fields ("Nama mempelai"), submit button ("Simpan & lanjut"), progress
  ("Langkah …"); server log clean ("Ready in 311ms", no request errors).
  Server terminated and artifacts removed.

## Generated artifacts

None persistent (smoke-test log/HTML deleted). `.next` build output remains
(normal, gitignored).

## Known risks / unresolved

1. **No browser-suite validation** (D8 user direction). Recommend manual QA
   before release: Chromium/Firefox/WebKit × 320–1440 widths, keyboard + focus
   order, reduced motion, console/network inspection — same as the auth task's
   open risk.
2. **Stub transport in place** — the entire real-API gate (tenant
   provisioning, authorization, persistence, real version conflicts) is ahead
   for the wedding-domain owner.
3. `/editor` 404s until MVP-UI-008 (accepted, same as `/daftar` pre-auth).
4. Multi-device draft divergence currently resolves only via the
   STALE_VERSION / force UI against the single-session stub; real
   cross-device semantics belong to the real API.
5. Date inputs have no client-side `min` (deliberate, see deviation 5) —
   past-date rejection is server-only; mobile native pickers still allow past
   selection that the server then rejects with the field message.

## Blockers

None.

## Approvals

Design plan approved as-is by the user (D1–D8, including D8 resolved to
unit + manual QA only per standing direction). High-risk items untouched
(no auth/session/DB/payment changes) — stub only, consistent with the
approved simulation-layer decision.

## Next action

Wedding-domain owner: implement the real `/weddings` `/events` `/venues`
backend against `lib/onboarding/contract.ts` (Security/Tenancy review + human
approval), then swap `stub-transport.ts` for the real client — no UI changes
should be needed if the contract holds. After that, MVP-UI-008 (editor) is the
next UI task in sequence.

## Rollback

All changes are additive files: delete `app/mulai/`, `app/onboarding.css`,
`components/onboarding/`, and `lib/onboarding/` to fully remove. Unit tests
are worth keeping if the contract is kept.
