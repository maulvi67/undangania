# Design Plan — MVP-UI-005 Authentication Screens

Status: AWAITING APPROVAL — no code written yet.
High-risk area per `AGENTS.md` (authentication/session): implementation starts only
after this plan is approved by Security review + human approver.

## 0. Context read

- `docs/domains/user-identity.md` — unique normalized email; status INVITED → ACTIVE
  → SUSPENDED → DELETED; revocable sessions; enumeration prevention named as a
  domain security consideration; `/auth` API namespace; auth provider dependency.
- `.ai/tasks/MVP-UI-005-AUTH.md` — required states (idle, submitting, invalid
  credentials, verification required, email sent, invalid/expired token, rate
  limited, session expired, suspended, provider unavailable, success redirect);
  no enumeration; paste/password-manager enabled; validated redirect;
  **file boundaries: UI + transport contract only — no provider/cookie/session/role changes.**
- `SECURITY_GUIDELINES.md` — secure cookies, CSRF, rate limiting, token hashing,
  never log tokens/cookies/email errors to analytics.
- Repo state: **no backend auth API exists anywhere** (`/auth` is unimplemented;
  `packages/contracts` has no auth DTOs). `/daftar` is already the register entry
  target of two shipped CTAs (template detail + sticky bar, MVP-UI-004) — this plan
  adopts it as a route-name obligation.
- Design system: `@wedding/ui` (server-safe fields; `Input` requires `id`, supports
  `hint`/`error` with aria wiring; `Alert`, `Button`, `StatePanel`), editorial
  aesthetic (ivory/paper, serif display, hairline borders, no gradients).

## 1. Situation and core decision

Auth is greenfield: the UI must exist before the backend. Therefore the plan
separates **contract** (what the backend must someday implement) from **stub
transport** (deterministic simulation so the UI is buildable, testable, and
demoable today without any credential handling).

Three-layer architecture:

1. `lib/auth/contract.ts` — Zod request/response schemas + error-code enum +
   safe-redirect validator. This is the handoff artifact to the identity owner.
2. `lib/auth/stub-transport.ts` — loud `SIMULATION ONLY` module: no storage, no
   session, no hashing; deterministic fixture accounts/tokens mapped to every
   required state. Replaceable 1:1 by a real client behind the same interface.
3. Route UI — forms as client components using React `useActionState` +
   server actions that call the transport. No cookie/session writes anywhere.

**The stub is the single biggest risk in this task** (shipped URLs that look like
auth but authenticate nothing). Mitigations: module-level warnings, success
destinations limited to interstitials/dashboard placeholder, explicit handoff flag,
and (open decision D5) the alternative of blocking merge until backend exists.

## 2. Anti-enumeration policy (the security spine)

| Flow | Disclosure risk | Behavior |
| --- | --- | --- |
| Sign in, wrong email or wrong password | reveals which one is wrong | One identical error for both: "Email atau kata sandi tidak cocok." (never "akun tidak ditemukan"). Timing parity is a backend contract requirement. |
| Sign in, valid credentials + SUSPENDED | none — requester proved credential ownership | Explicit suspended screen with support contact. Not enumeration: only reachable with the correct password. |
| Sign in, valid credentials + unverified | none (same reasoning) | "Akun belum diverifikasi" + resend-verification action. |
| Register, duplicate email | reveals account exists | **Never inline.** Registration always lands on the same "Cek email Anda" interstitial. If the email already exists, the backend sends an "email ini sudah terdaftar — masuk / lupa kata sandi" email instead (contract requirement R4). UI is byte-identical either way. |
| Forgot password, unknown email | reveals account exists | Always "Jika akun dengan email tersebut terdaftar, tautan pemulihan telah dikirim ke email Anda." Same copy, same timing, regardless. |
| Rate limited | — | Generic "Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi." (server-enforced; UI only renders the state; never a CAPTCHA in MVP) |

Analytics rule: no email values, no auth error codes, no token/tujuan URLs to
telemetry (task §11; mirrors "no auth error to analytics").

## 3. Route map (9 screens → 6 routes + states)

Indonesian route names, consistent with the existing `/daftar` obligation:

| # | Screen | Route | Notes |
| --- | --- | --- | --- |
| 1 | Sign in | `/masuk` | carries validated `?next=` |
| 2 | Register | `/daftar` | existing CTAs already point here |
| 3 | Verify email | `/verifikasi` | post-register interstitial **and** email-link landing via `?token=` — states: cek-email / memproses / berhasil / kedaluwarsa / tidak valid (+ kirim ulang) |
| 4 | Forgot password | `/lupa-sandi` | form state → always-success "email terkirim" state (same route, focus moved) |
| 5 | Reset password | `/reset-sandi` | email-link landing via `?token=` — states: form / kedaluwarsa / tidak valid / berhasil |
| 6 | Session expired | `/sesi-berakhir` | interstitial "Masuk kembali" preserving validated `next` |
| 7 | Expired link | state of 3 & 5 | distinct copy + recovery action per flow (verify → kirim ulang; reset → minta tautan baru) |
| 8 | Invalid link | state of 3 & 5 | distinct copy: "tautan tidak valid atau sudah pernah digunakan" + fall-back CTA |
| 9 | Suspended account | state of `/masuk` | valid-credentials-only path (see §2) |

Tokens travel in query params, never path segments (fewer canonical-URL/history
surfaces), never rendered in the UI, and both token routes are `noindex`.

## 4. Screen-by-screen specification

Shared shell (`AuthShell`): skip link → `main#konten-utama` → small logo link
home → one centered card (`max-width: 26rem`, hairline border, paper surface,
serif h1) → one cross-link row → minimal legal footer line. No marketing header.
One job per screen; single column; nothing behind hover/tooltip.

### 4.1 `/masuk` — Masuk

- H1 "Masuk". Lede: "Lanjutkan persiapan undangan Anda." (contextual, no claims)
- Fields: Email (`type=email`, `autocomplete=username`, `name=email`),
  Kata sandi (`type=password`, `autocomplete=current-password`, show/hide toggle).
- Submit "Masuk" (full-width, `enterkeyhint=go`, disabled+spinner while pending —
  **double-submit impossible**: pending disables button; server action idempotent by
  contract note R6).
- Field errors: per-field aria-wired; form-level error rendered as `Alert`
  (role=alert) above the form, focus moved to it on failed submit.
- Link row: "Lupa kata sandi?" → `/lupa-sandi`; "Belum punya akun? Daftar" → `/daftar`
  (both carry `next` through).
- States: idle / submitting / invalid-credentials (generic §2) / verification
  required / suspended / rate limited / provider unavailable (transport failure →
  "Layanan masuk sedang tidak tersedia. Silakan coba beberapa saat lagi.") /
  success → safe redirect (§5).

### 4.2 `/daftar` — Daftar

- H1 "Buat akun". Lede: "Satu akun untuk mengelola undangan Anda."
- Fields: Email (`autocomplete=email`), Kata sandi (`autocomplete=new-password`,
  toggle, paste encouraged). **No confirm-password field** (open decision D1) —
  managers + toggle + paste make double-typing cognitive overhead without safety gain.
- Hint under password mirrors the contract policy (placeholder: "Minimal 8
  karakter" — final policy is identity-owner input, see R2).
- Submit "Daftar" → always the interstitial state: H1 "Cek email Anda", body
  "Kami mengirimkan tautan verifikasi ke [email]. Tautan berlaku 24 jam." +
  "Buka aplikasi email" generic hint (no mailto deep links) + "Kirim ulang"
  (rate-limited, polite status) + "Salah email? Gunakan email lain" → `/daftar`.
- Duplicate email: identical interstitial (§2 R4). No inline "email sudah dipakai".

### 4.3 `/verifikasi` — Verifikasi email (two modes)

- **Interstitial mode** (no `?token=`): the "Cek email Anda" screen above,
  reachable post-register and post-resend.
- **Landing mode** (`?token=`): server component validates token via transport
  before render → one of:
  - *Berhasil:* H1 "Email terverifikasi", body akun aktif, single CTA "Masuk" →
    `/masuk` (verified sign-in; no auto-session — session creation is backend scope).
  - *Kedaluwarsa:* H1 "Tautan kedaluwarsa", body "Tautan verifikasi berlaku 24
    jam…" + CTA "Kirim ulang tautan" (email-entry mini-form → interstitial).
  - *Tidak valid:* H1 "Tautan tidak valid", body "Tautan sudah pernah digunakan
    atau tidak dikenali." + CTA "Masuk" / "Lupa kata sandi?" fallbacks.
- Invalid/expired must be distinguishable to the legitimate user (they explain
  *why*) without leaking anything (both states are only reachable by token holders).

### 4.4 `/lupa-sandi` — Lupa kata sandi

- H1 "Lupa kata sandi?". One field: Email. Submit "Kirim tautan pemulihan".
- Success state (same route): H1 "Periksa email Anda", **always-identical** copy
  (§2) + "Tautan berlaku 1 jam." + "Kirim ulang" (rate-limited) + link back to `/masuk`.
- No state, copy, or timing difference for unknown emails. Client validation only
  checks email *format* (that reveals nothing).

### 4.5 `/reset-sandi` — Atur ulang kata sandi (`?token=`)

- Server-validated token before the form renders:
  - *Form:* H1 "Atur ulang kata sandi", field Kata sandi baru
    (`autocomplete=new-password`, toggle, paste explicitly allowed — hint
    "Anda bisa menempel kata sandi dari pengelola kata sandi."), policy hint,
    submit "Simpan kata sandi baru".
  - *Berhasil:* "Kata sandi diperbarui" + CTA "Masuk dengan kata sandi baru" →
    `/masuk`. (No auto-login in MVP — session semantics are backend scope, R6.)
  - *Kedaluwarsa / tidak valid:* same distinct-copy pattern as verification, with
    CTA "Minta tautan baru" → `/lupa-sandi`.

### 4.6 `/sesi-berakhir` — Sesi berakhir

- Standalone lightweight interstitial: H1 "Sesi Anda berakhir", body "Untuk
  keamanan, Anda diminta masuk kembali." CTA "Masuk kembali" → `/masuk?next=…`
  (validated). Secondary "Kembali ke beranda" → `/`.
- Wiring from protected routes (401 → here) is **out of scope** — belongs to the
  dashboard task (MVP-UI-007) once sessions exist. This screen is the contract target.

## 5. Safe redirect policy (`lib/auth/redirect.ts`)

- `next` param accepted only if: starts with `/`, does NOT start with `//` or `/\`,
  has no scheme/authority/host, and its pathname is on the app-internal allowlist
  (MVP: `/templates`, `/daftar`, `/verifikasi`… extended by the dashboard task).
- Everything else (external origin, protocol-relative, non-allowlisted path,
  malformed) silently falls back to the default destination — **open decision D3**:
  `/` until the dashboard exists (MVP-UI-007), then `/dashboard`.
- Validation runs **server-side** in the server action before any redirect; the
  client never trusts `next` for navigation. Unit-tested exhaustively (the classic
  bypasses: `//evil.com`, `/\evil.com`, `https:evil`, `%2F%2F`, `/\t//`, `//@`).
- `next` is carried through `/masuk` ↔ `/daftar` ↔ `/lupa-sandi` (auth-internal
  hops) but **dropped** on email-link flows (`/verifikasi`, `/reset-sandi`) — email
  links are authoritative; appending app state to emailed URLs leaks intent and
  invites tampering.

## 6. Password-manager, paste, and keyboard policy

- Real `<form>` with `action`; native semantics only; no `onPaste` interception
  anywhere (repo-wide grep gate in tests); no copy-blocking.
- `autocomplete` tokens: `username`/`email` + `current-password` (sign-in);
  `email` + `new-password` (register, reset). Plain `name` attributes (`email`,
  `password`).
- Show/hide toggle: separate `<button aria-pressed>` inside the field wrapper,
  accessible name "Tampilkan kata sandi"/"Sembunyikan kata sandi"; does not rename
  or re-create the input (manager capture preserved).
- Mobile keyboards: `type=email` + `inputmode=email` + `autocapitalize=none` +
  `autocorrect=off` + `spellcheck=false` on email; `autocapitalize=none` +
  `autocorrect=off` on passwords; `enterkeyhint` per screen (go/send/done); Enter
  submits; all controls ≥44px; base font 1rem (iOS no-zoom).
- Low cognitive load: ≤2 fields per screen, one primary action, errors in
  Indonesian plain language naming the fix, no distractor marketing content.

## 7. Accessibility contract

- Per task §8: landmarks, single h1 per screen, full keyboard path (tab order:
  skip → logo → fields → toggle → submit → cross-links), visible focus (system
  outline), field errors `aria-describedby` + `aria-invalid` (already in `Input`),
  form-level Alert announced (role=alert) with focus move on submit failure,
  pending state polite status, **no focus stealing** on success swaps (focus moved
  once to the new panel heading via `tabIndex={-1}.focus()`), toggle has
  `aria-pressed`, color never sole indicator, reduced-motion honored (no
  non-essential transitions), 200% zoom reflow at 320px.
- Manual additions: password toggle usable with VoiceOver/TalkBack spot check;
  error text understandable without field context.

## 8. Performance

- Zero third-party scripts; no provider script at all in MVP (none exists).
- Pages are tiny server components; only forms are client components
  (`useActionState`). Target: initial JS ≈ Next runtime baseline (~137KB measured
  on /templates), CSS marginal (+~3KB `auth.css`).
- No client-side validation duplication beyond format hints; the server action is
  the validator (task §10).

## 9. Transport contract (identity-owner handoff, `lib/auth/contract.ts`)

Zod schemas for: `signIn`, `register`, `resendVerification`, `verifyEmail`,
`requestPasswordReset`, `resetPassword` — each with typed error codes
(`INVALID_CREDENTIALS`, `VERIFICATION_REQUIRED`, `SUSPENDED`, `RATE_LIMITED`,
`PROVIDER_UNAVAILABLE`, `EMAIL_SENT`…). Backend requirements encoded as notes:
R1 identical timing for invalid email vs wrong password; R2 password policy
ownership; R3 forgot-password always-200 semantics; R4 register-duplicate email
path; R5 token TTLs (verification 24h, reset 1h — placeholders for PM); R6
redirect + session creation happen server-side only; R7 no PII/token logging.

Stub fixture surface (deterministic, `@example.com` only): `terdaftar@` → success,
`belum-verifikasi@` → verification required, `ditangguhkan@` → suspended, others →
generic invalid; tokens `verifikasi-valid` / `verifikasi-kedaluwarsa` /
`reset-valid` / `reset-tidak-valid` etc. — mapped to every required state so e2e
covers 100% of the state matrix without real credentials.

## 10. Exact files

```
apps/customer-web/src/lib/auth/contract.ts            (schemas + error codes)
apps/customer-web/src/lib/auth/contract.test.ts
apps/customer-web/src/lib/auth/redirect.ts            (allowlist validator)
apps/customer-web/src/lib/auth/redirect.test.ts
apps/customer-web/src/lib/auth/stub-transport.ts      (SIMULATION ONLY)
apps/customer-web/src/lib/auth/actions.ts             (server actions)
apps/customer-web/src/components/auth/auth-shell.tsx
apps/customer-web/src/components/auth/password-field.tsx
apps/customer-web/src/components/auth/email-field.tsx
apps/customer-web/src/components/auth/auth-link-row.tsx
apps/customer-web/src/components/auth/check-email-panel.tsx  (shared interstitial)
apps/customer-web/src/components/auth/token-state-panel.tsx  (expired/invalid)
apps/customer-web/src/app/auth.css
apps/customer-web/src/app/masuk/page.tsx
apps/customer-web/src/app/daftar/page.tsx
apps/customer-web/src/app/verifikasi/page.tsx
apps/customer-web/src/app/lupa-sandi/page.tsx
apps/customer-web/src/app/reset-sandi/page.tsx
apps/customer-web/src/app/sesi-berakhir/page.tsx
tests/e2e/auth.spec.ts
tests/accessibility/auth.a11y.spec.ts
tests/responsive/auth.responsive.spec.ts
```

No existing file changes (both `/daftar` CTAs already point at the new route).
`next.config` untouched (Referrer-Policy header recommended at infra level — noted
for token pages, out of file boundary).

## 11. Test plan

- **Unit:** contract parse/reject per endpoint; redirect validator bypass corpus
  (incl. `%2F%2F`, `/\`, control chars, allowlist misses); stub determinism.
- **E2E (Playwright, 4 projects):** every screen renders; happy paths through the
  stub; generic-error equality for unknown-email vs wrong-password (string-identical
  assertion); register duplicate → identical interstitial; forgot-password unknown
  email → identical success copy; suspended/unverified/rate-limited states; token
  landing matrix (valid/expired/invalid × verify/reset); double-submit blocked
  (button disabled while pending); paste enabled (clipboard insert into password);
  autocomplete/name attribute assertions; toggle aria-pressed cycle; safe-redirect
  (external `next` → fallback); `/daftar` reachable from template-detail CTA;
  noindex on token routes.
- **A11y:** axe (zero critical/serious) per screen × key states (error, suspended,
  expired); manual keyboard pass; screen-reader spot check.
- **Responsive:** 320/375/390/768/1024/1440 no overflow; virtual-keyboard layout
  (viewport height shrink); 200% zoom.
- **Performance:** JS/CSS budget vs `/templates` baseline; console/network clean.
- **Gates:** typecheck, unit, build, e2e, a11y, responsive, ui-performance; then
  Security review of the stub boundary + human approval before any real
  credential handling ever lands.

## 12. Open decisions requiring approval

- **D1** No confirm-password on register/reset (toggle + paste instead).
- **D2** Register anti-enumeration via always-interstitial + differentiated email
  (backend contract R4) — identity owner must accept.
- **D3** Post-login default destination `/` until `/dashboard` exists.
- **D4** Suspended screen shown only to valid-credential holders — confirm.
- **D5** Ship the stub-transport simulation at all before the backend exists
  (Security call: accept stub, or hold merge until provider integration).
- **D6** Token TTLs 24h/1h placeholders pending PM.
- **D7** Route names `/masuk`, `/daftar`, `/verifikasi`, `/lupa-sandi`,
  `/reset-sandi`, `/sesi-berakhir` ( Bahasa Indonesia, matches `/daftar` debt).

## 13. Explicitly out of scope (task §5 + AGENTS high-risk)

No identity provider selection/integration, no cookie/session writes, no MFA UI,
no OAuth/social login, no middleware wiring, no role logic. Real credential
handling arrives only with Security-reviewed backend work.
