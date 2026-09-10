# Agent Handoff — MVP-UI-005 Authentication Screens

**Task ID:** MVP-UI-005 (Authentication screens UI)
**From/To agent:** UI implementation agent → next agent (identity owner / dashboard MVP-UI-007)
**Status:** Code complete (typecheck, unit, build, lint green). Browser-suite validation removed per user direction — see "Validation" and "Known risks". CONDITIONAL APPROVE (see decision).

## Objective

All 9 auth screens (6 routes + states) for `apps/customer-web`, per the user-approved
design plan `.ai/handoffs/MVP-UI-005-DESIGN-PLAN.md`: sign-in, register, verify email,
forgot password, reset password, session expired, expired link, invalid link, suspended
account. Anti-enumeration, password-manager compatibility, paste enabled, safe redirect,
accessible authentication, Bahasa Indonesia copy.

## Context read

Design plan (authoritative); identity domain rules; SECURITY_GUIDELINES.md; AGENTS.md
high-risk list (no auth provider changes without Security review — respected: stub only).

## Decisions (all user-approved in plan §12)

- **D1** No confirm-password field (toggle + paste + manager support instead).
- **D2** Register anti-enumeration via always-interstitial; duplicate email is
  byte-identical to fresh registration (stub always ok; real differentiation is
  email-content-only, backend contract R4).
- **D3** Post-login default destination `/` until `/dashboard` exists (MVP-UI-007).
- **D4** Suspended screen shown only to valid-credential holders (wrong password
  returns generic INVALID_CREDENTIALS first).
- **D5** Stub transport ships (SIMULATION ONLY) — Security gate before any real
  credential handling.
- **D6** Token TTL copy: verification 24h, reset 1h (placeholders pending PM).
- **D7** Indonesian routes: `/masuk`, `/daftar`, `/verifikasi`, `/lupa-sandi`,
  `/reset-sandi`, `/sesi-berakhir`.

Additional implementation decisions:

- **Client forms own the screen `<h1>`** so every state has exactly one h1 (idle state
  renders "Masuk"/"Buat akun"/etc.; swapped states render their own panel h1). A
  double-h1 bug was caught and fixed during validation.
- Form-level errors render as `Alert variant="error"` (role=alert) with focus moved to
  the alert wrapper on failed submit; field errors stay aria-wired per field.
- Focus moves once to the new panel heading (`tabIndex={-1}.focus()`) on success swaps
  (register interstitial, forgot-password done, reset done) — no focus stealing.
- `noValidate` on all auth forms: the server action is the single validator (plan §8).
- `/verifikasi` without token doubles as the expired-link recovery entry (email-entry
  resend mini-form).
- Resend control is dual-mode: hidden-email "Kirim ulang" on interstitials, email-entry
  form on `/verifikasi`.
- Tokens travel in query params only, are never rendered, and token routes + session
  route are `noindex`.
- `next` is server-validated (page) and re-validated (action) before any redirect;
  external/malformed values silently fall back to `/`. Unit-tested against the classic
  bypass corpus.

## Files changed

Created (lib — pre-existing from earlier session, unchanged):
- `apps/customer-web/src/lib/auth/contract.ts` (Zod schemas, error codes/messages,
  AuthFormState, normalizeEmail, isAdequatePassword)
- `apps/customer-web/src/lib/auth/contract.test.ts` (12 unit tests)
- `apps/customer-web/src/lib/auth/redirect.ts` + `redirect.test.ts` (9 unit tests)
- `apps/customer-web/src/lib/auth/stub-transport.ts` (⚠️ SIMULATION ONLY)
- `apps/customer-web/src/lib/auth/actions.ts` ("use server" actions)
- `apps/customer-web/src/lib/auth/token-check.ts` (server-side token landing checks)

Created (UI — this session):
- `apps/customer-web/src/components/auth/auth-shell.tsx` (skip link → main → logo → card)
- `.../email-field.tsx` (manager/mobile attribute set)
- `.../password-field.tsx` (client; show/hide `aria-pressed` toggle; paste never blocked)
- `.../auth-link-row.tsx`
- `.../check-email-panel.tsx` (verification echoes typed email; reset variant is
  always-identical copy, never echoes)
- `.../token-state-panel.tsx` (expired/invalid × verification/reset, distinct copy)
- `.../sign-in-form.tsx` (+ exported `formLevelMessage`), `.../register-form.tsx`,
  `.../forgot-password-form.tsx`, `.../reset-password-form.tsx`, `.../resend-email-form.tsx`
- `apps/customer-web/src/app/auth.css` (auth-* scope, ~4KB)
- `apps/customer-web/src/app/{masuk,daftar,verifikasi,lupa-sandi,reset-sandi,sesi-berakhir}/page.tsx`

Modified: none outside new files. `next.config` untouched.

Removed per user direction (this session): the Playwright suites
(`tests/e2e/auth.spec.ts`, `tests/accessibility/auth.a11y.spec.ts`,
`tests/responsive/auth.responsive.spec.ts`) and the Playwright-based evidence script.

## Schema/API/event changes

None. The transport contract (`lib/auth/contract.ts`) is the handoff artifact the
identity owner must implement: R1–R7 requirements (identical timing for unknown email
vs wrong password; server-owned password policy; always-200 forgot; register duplicate
indistinguishable; token TTLs 24h/1h; server-only redirects/sessions; no PII/token
logging).

## Security/privacy impact

- **No real authentication exists.** The stub authenticates nobody and stores nothing;
  no routes served by it may be described as secure or production-auth.
- Replacing the stub with a real provider client is an AGENTS.md high-risk change:
  Security review + human approval required.
- Anti-enumeration: sign-in generic error (byte-identical for unknown email vs wrong
  password); register always-interstitial; forgot-password always-identical copy
  (never echoes the address).
- Safe redirect: allowlist + bypass corpus covered by unit tests; client never trusted.
- No cookies, no sessions, no middleware, no analytics on auth errors/emails.
- Recommended infra follow-up (out of file boundary): `Referrer-Policy` header on
  token routes.

## Commands and results

- `npm run typecheck -w @wedding/customer-web` — **pass**
- `npm test -w @wedding/customer-web` — **51/51 pass** (contract 12, redirect 9,
  plus pre-existing catalog/template suites)
- `npm run build -w @wedding/customer-web` — **pass** (all 6 auth routes render;
  /lupa-sandi static, others dynamic)
- `npx eslint` on all new auth files — **pass** (0 errors/warnings)
- Browser e2e/a11y/responsive suites: authored and run twice diagnostically. Run 1
  exposed a real app bug (double `<h1>` after state swaps) — **fixed** (forms now own
  the heading). Run 2's remaining 32 failures were all diagnosed as test-harness
  issues (Next.js `__next-route-announcer__` matching unscoped `[role=alert]`
  locators; `"onpaste" in el` being true as an IDL attribute; `next/link` prefetch
  aborts polluting network checks), with fixes applied — but the suites were then
  removed per user direction and **not run to completion**.

## Known risks / unresolved

1. **No completed browser-suite validation** for the auth UI (user direction). The
   diagnosed harness fixes were never verified end-to-end; recommend re-adding the
   suites (or equivalent manual QA: Chromium/Firefox/WebKit × 320–1440, keyboard
   order, reduced motion, console/network) before release.
2. **Stub transport in place** — the entire Security gate for real credentials is
   still ahead (identity owner).
3. Sign-in `redirect()` inside `useActionState` works against the stub; re-verify
   when the real provider lands.
4. Token TTL copy (24h/1h) awaits PM confirmation.

## Next action

Identity owner: implement the real `/auth` backend against `lib/auth/contract.ts`
(Security review + human approval), then swap `stub-transport.ts` for the provider
client — no UI changes should be needed if the contract holds.

## Rollback

All changes are additive files; delete the six route dirs, `auth.css`,
`components/auth/`, and `lib/auth/` to fully remove. Unit tests for contract/redirect
are worth keeping for the real backend.
