# Design Plan — MVP-UI-007 Customer Dashboard

Status: APPROVED — IMPLEMENTED

## 0. Context read

- Task `MVP-UI-007-CUSTOMER-DASHBOARD.md` (§16: "Define state-to-primary-action
  mapping before code"; decision-oriented dashboard, not a card collection)
- `docs/domains/`: digital-invitation (DRAFT → READY → PUBLISHED ↔ PAUSED →
  EXPIRED), order (PENDING_PAYMENT), pricing-package (entitlement),
  guest-management (households/tokens), rsvp (PENDING → ATTENDING/DECLINED/
  TENTATIVE), wedding-event (timezone-explicit)
- Established product facts: `INVITATION_ACTIVE_PERIOD` = "aktif mulai
  publikasi hingga 30 hari setelah tanggal acara; sebelum berakhir dapat
  mengunduh data tamu & buku tamu" (pricing-explanation.tsx); vocabulary
  "Konfirmasi kehadiran" (RSVP), "Buku tamu", "Impor tamu"
- MVP-UI-005 auth: `DEFAULT_REDIRECT = "/"` documented as "(D3: / until
  /dashboard exists (MVP-UI-007))" — this task is that completion point
- MVP-UI-006 onboarding: /mulai, summary formatting, UTC-anchored wall dates
  (todayYmd), z.enum-in-base + superRefine + FlowState precedents, stub
  transport precedent
- @wedding/ui: ApplicationShell (brand + nav + drawer + footer, skip link),
  Alert (info/success/warning/error), Badge (neutral/olive/gold/blush),
  Button, StatePanel/EmptyState/ErrorState, Skeleton/LoadingState
- Visual direction: ivory bg, paper surfaces, ink text, olive primary, serif
  display font, hairline borders, soft shadows, calm and warm — no gradient
  clutter, no decorative card walls

## 1. Situation and core decision

No wedding/invitation/guest/RSVP backend exists (auth and onboarding shipped
against stubs; contracts are the handoff artifacts). The dashboard ships the
same way: a **read-only aggregate simulation layer** — server component reads
one deterministic aggregate DTO from a stub provider (⚠️ SIMULATION ONLY) and
renders sections directly. The contract in `lib/dashboard/contract.ts` is the
handoff artifact for the real aggregate API (tenant-scoped, session-gated).

Primary job: answer "what must I complete next?" and give fast access to
invitation/guests/RSVP. Not a statistics wall: no charts, counts only where a
decision needs them, everything else links to detail screens.

## 2. Route, entry, and auth integration

- Route: `/dashboard` (the route named in MVP-UI-005 D3). Post-login default
  destination changes `/` → `/dashboard` by completing the documented D3:
  - `lib/auth/redirect.ts`: `DEFAULT_REDIRECT = "/dashboard"`;
    `ALLOWED_DESTINATIONS += "/dashboard"` (enables `/masuk?next=/dashboard`
    round-trips via `signInHref`)
  - `lib/auth/redirect.test.ts`: explicit assertions for the new default and
    the new allowlist entry (existing corpus uses the constant symbolically
    and stays green)
- Resulting journey: daftar/masuk → /dashboard → next-action CTA → /mulai |
  /editor | /pesanan … The dashboard is the single "what's next" brain;
  flows return to it.
- Page is a server component; `searchParams` (Next 16 Promise) read for the
  fixture switch (§8). Dynamic rendering (like /mulai). No cookies/sessions
  exist — the stub pretends an authenticated OWNER by default and the
  unauthenticated state is fixture-driven (§8) until real auth lands.

## 3. Information model — the aggregate DTO

One server-side fetch; per-section availability supports the partial-failure
acceptance criterion. All types + Zod schemas live in the contract (the
handoff boundary for the real API).

```ts
type Section<T> = { status: "ok"; data: T } | { status: "unavailable" };

type DashboardAggregate = {
  role: "OWNER" | "EDITOR";
  workspace: {
    coupleNames: string | null; // null in new-workspace state
    weddingDate: string | null; // ISO date or null (undecided/not set)
    timezone: string | null; // IANA
    city: string | null;
  };
  invitation: Section<{
    status: "DRAFT" | "READY" | "PUBLISHED" | "PAUSED" | "EXPIRED";
    templateName: string | null;
    contentComplete: boolean; // editor sections done
    publishedAt: string | null; // ISO datetime
    publicUrl: string | null; // set when PUBLISHED/PAUSED
    activeUntil: string | null; // eventDate + 30d (computed server-side)
  }>;
  payment: Section<{ state: "OK" | "PENDING" }>;
  guests: Section<{ guestCount: number; householdCount: number }>;
  rsvp: Section<{
    invited: number;
    attending: number;
    declined: number;
    tentative: number;
    pending: number;
  }>;
};

type DashboardLoad =
  | { kind: "ok"; data: DashboardAggregate }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };
```

Derived, pure, and unit-tested in the contract:
`deriveDashboardState()` (the 8 required states + payment overlay),
`nextActions()` (ranked, role-filtered, max 3), `countdownText()`,
`activePeriodText()`, `completionItems()`.

## 4. State model — the state-to-primary-action mapping (core)

| #   | State               | Status label (Badge)  | Primary action                 | CTA target             |
| --- | ------------------- | --------------------- | ------------------------------ | ---------------------- |
| 1   | New empty workspace | "Belum dimulai"       | Lengkapi data dasar            | /mulai                 |
| 2   | Draft invitation    | "Draf undangan"       | Lanjut menyusun undangan       | /editor                |
| 3   | Ready to publish    | "Siap diterbitkan"    | Periksa dan terbitkan          | /editor                |
| 4   | Published           | "Undangan aktif"      | Bagikan undangan Anda          | publicUrl (MVP-UI-009) |
| 5   | Paused              | "Dijeda"              | Terbitkan kembali              | /editor                |
| 6   | Expiring soon       | "Segera berakhir"     | Unduh data tamu dan buku tamu  | /tamu                  |
| 7   | Expired             | "Berakhir"            | Lihat pesanan / koleksi desain | /pesanan, /templates   |
| 8   | Payment pending     | "Menunggu pembayaran" | Selesaikan pembayaran          | /pesanan               |

Orthogonal whole-page states: unauthenticated (sign-in StatePanel, §8),
provider unavailable (full ErrorState), loading (route skeleton).

Rules:

- `deriveDashboardState()`: no workspace data → NEW; payment PENDING →
  PAYMENT_PENDING overlays the lifecycle status (publish is blocked by
  entitlement — invitation domain validation); PUBLISHED with ≤14 days of
  active period left → EXPIRING; past activeUntil → EXPIRED.
- `nextActions()` ranking: (1) payment pending (blocks publishing), (2)
  time-critical download (expiring/expired), (3) lifecycle primary, (4)
  published extras (share, import guests when guestCount = 0). Dedup by target,
  max 3, first = primary Button variant, rest secondary.
- Role gating: EDITOR never receives billing CTAs (/pesanan links, payment
  action). Payment warning still renders for editors as an informative notice
  ("Pemilik undangan perlu menyelesaikan pembayaran") — no dead ends, no
  hidden causes — but no action they cannot perform.

## 5. Composition

ApplicationShell (ui kit): skip link, brand, nav, footer. Nav = the quick
access: Dasbor (current), Editor /editor, Tamu /tamu, RSVP /rsvp, Buku tamu
/buku-tamu, Pesanan /pesanan (OWNER only; role-gated). Desktop: persistent
header links. Mobile: drawer. No duplicate in-body "quick access" card grid —
every summary and checklist item deep-links contextually instead (avoid the
card-collection pattern).

Desktop (≥1024):

```
h1 "Dasbor" + lead (couple names · city, or empty-workspace hint)
[Countdown band] slim full width: "H-87 · Sabtu, 21 Maret 2026 · WIB"
[Alerts] payment pending (warning) · expiring (warning) · expired (info)
["Langkah berikutnya"] status Badge + reason line + primary CTA (+≤2 secondary)
[2 columns]  "Status undangan" (status, active period, public link)
             "Progres persiapan" (5-item checklist + segmented hairline bar)
[2 columns]  "Konfirmasi kehadiran" (RSVP counts)  ·  "Tamu" (guest counts)
[Bantuan] one quiet line linking /#faq
```

Mobile (320–767): identical order, single column — countdown → alerts →
next action → status/progress → RSVP/guests → bantuan. Nothing sticky (task
§9: nothing may obscure focused content); all sections in normal flow.

## 6. Section specs

- **Countdown band**: wall-date in the wedding timezone, UTC-anchored
  (reuses onboarding's `todayYmd` approach; day-diff, not duration).
  `H-<n>` (n≥1) · full formatted date (id-ID always — product UI language) ·
  tz label (WIB/WITA/WIT). Today: "Hari ini hari pernikahan Anda — selamat!"
  Past: "Acara Anda telah berlangsung pada <date>." Undecided/no data:
  "Tanggal pernikahan belum ditentukan." No client-side timer (server text;
  refreshes on navigation — staleness across midnight is acceptable, no
  hydration risk, no motion).
- **Alerts**: only payment pending (warning: "Pembayaran belum selesai —
  undangan belum bisa diterbitkan.") and expiry (warning ≤14 days with the
  exact end date; info once expired). Paused/new/draft/ready get no alert —
  the status section explains them. No alert fatigue.
- **Langkah berikutnya** (the heart): one reason sentence per state (§9 copy
  catalog) + CTAs from §4. Published also shows the public URL as plain
  selectable text (share affordances live on the invitation page — no
  clipboard JS here).
- **Status undangan**: Badge + one-sentence state explanation + active-period
  line ("Masa aktif hingga <date> · sisa X hari" when relevant) + public link
  when published. Counts down from the established
  publication → event+30 days rule.
- **Progres persiapan** (explainable calculation): 5 checklist items, each
  visible with done/undone state and its own link — 1) Data dasar (from
  onboarding; → /mulai), 2) Desain dipilih (→ /templates), 3) Konten
  undangan selesai (editor; → /editor), 4) Data tamu diisi (≥1 tamu; → /tamu), 5) Undangan diterbitkan (status PUBLISHED/PAUSED/EXPIRED). "X dari 5
  selesai" + 5-segment hairline bar (onboarding-progress visual). Never a
  bare percentage — the list IS the calculation.
- **Konfirmasi kehadiran** (RSVP): headline "X dari Y tamu sudah menjawab" +
  dl rows Hadir / Berhalangan / Mungkin / Belum menjawab + "Kelola
  konfirmasi" → /rsvp. Empty: "Belum ada tamu yang menjawab." Counts only —
  no names, no contacts (§11 masking).
- **Tamu**: "X tamu dalam Y grup" + "Kelola tamu" → /tamu. Empty: "Belum ada
  tamu — impor daftar tamu Anda." Counts only.
- **Partial failure**: guests/RSVP sections may be independently
  `unavailable` → compact inline error panel with a direct link to that
  detail screen + reload link. The rest of the dashboard stays intact
  (acceptance criterion §12.3).
- **Bantuan**: "Butuh bantuan? Lihat pertanyaan umum." → /#faq (real, exists).

## 7. Required states matrix and fixtures

Fixture switching via validated `?state=` query param (server-side allowlist;
invalid → default silently; documented in the stub header; disappears with
the real API). Default (no param) = `baru`. Dates are computed relative to
"now" at request time so fixtures stay evergreen.

| state=                | Demonstrates         | Key fixture facts                                  |
| --------------------- | -------------------- | -------------------------------------------------- |
| _(default)_           | New empty workspace  | no workspace data, no invitation                   |
| `draf`                | Draft                | data + template, contentComplete=false, 0 guests   |
| `siap`                | Ready to publish     | contentComplete=true                               |
| `aktif`               | Published            | published, publicUrl, guests+RSVP counts           |
| `jeda`                | Paused               | paused, publicUrl, "tamu tidak dapat membuka" copy |
| `segera-berakhir`     | Expiring soon        | event 16 days past → 14 days remaining             |
| `berakhir`            | Expired              | activeUntil 15 days past                           |
| `menunggu-pembayaran` | Payment pending      | READY + order PENDING (OWNER)                      |
| `peninjau`            | Editor role          | payment pending + role EDITOR (no billing CTA)     |
| `belum-masuk`         | Unauthorized         | unauthenticated whole-page state                   |
| `gangguan`            | Provider unavailable | aggregate unavailable whole-page state             |
| `ringkasan-gagal`     | Partial failure      | RSVP section unavailable, rest ok                  |

## 8. Whole-page states

- **Loading** (`app/dashboard/loading.tsx`): skeleton mirroring the section
  layout (band, next-action block, two two-column rows) — no layout shift.
- **Unauthenticated**: StatePanel "Anda belum masuk" + [Masuk] via
  `signInHref("/dashboard")` + [Buat akun] → `/daftar?next=/dashboard`.
  (Rendered panel, not a redirect — the stub has no session; a redirect would
  make every fixture unreachable until real auth lands.)
- **Provider unavailable**: ErrorState "Dasbor tidak dapat dimuat" + [Coba
  lagi] (link re-request) + bantuan link.
- **Unauthorized vs. suspended**: out of scope — identity layer owns it
  (MVP-UI-005 states already exist; no roles/session exist yet).

## 9. Copy catalog (Bahasa Indonesia, per state)

| State     | Reason line (next-actions section)                                                                                                                                              | Primary button                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| NEW       | "Isi nama mempelai dan acara pertama untuk mulai menyusun undangan."                                                                                                            | "Mulai isi data"                                   |
| DRAFT     | "Undangan Anda belum selesai. Buka editor untuk melanjutkan."                                                                                                                   | "Buka editor"                                      |
| READY     | "Semua isian lengkap. Periksa hasil akhir, lalu terbitkan."                                                                                                                     | "Periksa undangan"                                 |
| PUBLISHED | "Undangan aktif dan bisa dibuka tamu. Bagikan tautannya."                                                                                                                       | "Lihat undangan"                                   |
| PAUSED    | "Undangan sedang dijeda — tamu tidak dapat membukanya."                                                                                                                         | "Terbitkan kembali"                                |
| EXPIRING  | "Masa aktif berakhir dalam X hari, pada <date>. Unduh data tamu dan buku tamu sebelum batas ini."                                                                               | "Unduh data tamu"                                  |
| EXPIRED   | "Masa aktif undangan berakhir pada <date>. Data tamu tidak lagi dapat diunduh."                                                                                                 | "Lihat pesanan" + secondary "Lihat koleksi desain" |
| PENDING   | "Undangan Anda sudah disusun — selesaikan pembayaran untuk menerbitkannya." (EDITOR: "Pemilik undangan perlu menyelesaikan pembayaran agar undangan bisa diterbitkan.", no CTA) | "Lihat pesanan"                                    |

## 10. Accessibility

ApplicationShell landmarks (header/nav/main/footer + skip link); one h1
("Dasbor"); sections are h2; alerts role=alert/status per ui-kit variants;
status never color-only (Badge text + full sentences); checklist done-state
is icon + text (visually-hidden "Selesai:"); 44px targets; visible focus
(ui tokens); no motion beyond existing transitions; reduced-motion respected
(no new animation); counts in semantic dl/ul; drawer trigger labeled
("Menu"); keyboard order = reading order; no sticky element can cover focus.

## 11. SEO/metadata and performance

- Private page: `robots: { index: false }`, no canonical/OG promotion; title
  "Dasbor — Undangania".
- One server-side aggregate read; zero client fetch (no waterfalls, task
  §10); no charts; no images; only client JS = shell drawer; route-level
  loading skeleton; dynamic rendering.

## 12. Security/privacy

- ⚠️ SIMULATION ONLY stub: in-memory, no tenant/session, resets on restart;
  header documents every fixture trigger (same pattern as auth/onboarding
  stubs). Real aggregate API is the Security/Tenancy-reviewed handoff
  (tenant-scoped, session-gated, role-sourced).
- Guest/RSVP/contact data: counts only, never names/numbers on the dashboard.
- No PII in URLs (state param = allowlisted slugs). Noindex prevents
  crawling of a private screen.

## 13. Exact files

```
Modified (auth integration — flagged, needs approval: D1):
  apps/customer-web/src/lib/auth/redirect.ts        DEFAULT_REDIRECT → "/dashboard"; allowlist += /dashboard
  apps/customer-web/src/lib/auth/redirect.test.ts   explicit default + allowlist assertions

New:
  apps/customer-web/src/lib/dashboard/contract.ts        aggregate DTO + Zod + pure derivations
  apps/customer-web/src/lib/dashboard/contract.test.ts    state matrix, ranking, countdown/expiry math, fixtures
  apps/customer-web/src/lib/dashboard/stub-transport.ts   ⚠️ SIMULATION ONLY (fixture table + ?state= switch)
  apps/customer-web/src/components/dashboard/countdown-band.tsx
  apps/customer-web/src/components/dashboard/next-actions.tsx
  apps/customer-web/src/components/dashboard/invitation-status.tsx
  apps/customer-web/src/components/dashboard/completion-progress.tsx
  apps/customer-web/src/components/dashboard/rsvp-summary.tsx
  apps/customer-web/src/components/dashboard/guest-summary.tsx
  apps/customer-web/src/components/dashboard/dashboard-view.tsx   composes; unauthenticated/unavailable states
  apps/customer-web/src/app/dashboard/page.tsx
  apps/customer-web/src/app/dashboard/loading.tsx
  apps/customer-web/src/app/dashboard.css                dash-* scope, tokens only
```

All components server-rendered (no "use client" except the kit's Drawer
already in ApplicationShell). `next.config` untouched.

## 14. Test plan (standing direction D8: unit + smoke, no Playwright)

- Unit (contract.test.ts): derivation matrix — every lifecycle state ×
  payment overlay × role; ranking rules (payment first, time-critical second,
  dedup, max 3, EDITOR filter); countdown (future/today/past/undecided ×
  3 Indonesian timezones, UTC-anchored day boundary); expiry thresholds
  (14-day boundary, 30-day window, past); completion derivation; fixture
  table (all fixtures validate against Zod; every required UI state reachable
  by ≥1 fixture; invalid state param → default).
- redirect.test.ts: new default destination + /dashboard allowlisted (child
  paths + query preserved).
- Gates: typecheck, test, build, eslint (app cwd) — all green; curl smoke:
  /dashboard + every ?state= fixture (HTTP 200 + key markers per state),
  post-redirect constant behavior.
- Manual QA checklist recorded in handoff as open risk (320–1440 widths,
  3 engines, keyboard order, reduced motion, console/network) — deferred per
  standing direction.

## 15. Out of scope (task §5 + boundaries)

Charts/analytics, admin controls, real session/roles, sign-out (needs a real
session), landing-page "Masuk" header link (MVP-UI-002 file — follow-up),
real guest/contact data, editable anything.

## 16. Open decisions requiring approval

- **D1** Route `/dashboard` + completing MVP-UI-005 D3 (post-login default
  redirect change; touches the two auth files listed — auth-adjacent, minimal
  diff, tests updated).
- **D2** Simulation layer ships (stub aggregate, pretend-session default,
  no tenant/session) — real aggregate API is the Security/Tenancy handoff.
- **D3** Fixture switching via validated `?state=` param (allowlisted
  Indonesian slugs, invalid → default silently, documented in stub header).
- **D4** Countdown "H-<n>" band, UTC-anchored wall dates in the wedding
  timezone, server-rendered text (no client timer, staleness on open tabs
  acceptable).
- **D5** Expiry semantics: active period = publication → event date + 30
  days (established product rule); "expiring soon" = ≤14 days remaining;
  alerts only for payment-pending and expiry (paused/ready get none).
- **D6** Quick access = persistent role-gated ApplicationShell nav (drawer on
  mobile), no duplicate in-body link grid.
- **D7** Contract-target routes for MVP-UI-008/010/011/012: /editor, /tamu,
  /rsvp, /buku-tamu, /pesanan (404 until built — accepted pattern; later
  tasks align to the route map exported by the contract).
- **D8** No Playwright suites (standing direction) — unit tests + curl smoke
  now; manual QA checklist in the handoff for the release gate.
- **D9** Dashboard dates always formatted id-ID (product UI language),
  regardless of invitation locale.
