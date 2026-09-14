# Design Plan — MVP-UI-006 Wedding Workspace Onboarding

Status: PROPOSED — awaiting approval. No code until approved.

## 0. Context read

- Task `MVP-UI-006-ONBOARDING.md` (objective, states, boundaries, reviewers)
- `docs/domains/wedding-event.md` (Wedding/CoupleProfile/Event/Venue entities;
  explicit timezone; tenant ownership; /weddings /events /venues API target)
- `packages/contracts` (no wedding/workspace DTOs exist), `packages/domain`,
  `packages/application` (ports only)
- MVP-UI-005 auth implementation (route/language conventions, stub-transport
  precedent, form patterns), MVP-UI-004 demo (event vocabulary "Akad Nikah",
  "Resepsi"), @wedding/ui kit (Input/Textarea/Select/Checkbox/RadioGroup/Alert/
  Button — all aria-wired)

## 1. Situation and core decision

No backend exists for weddings/events (contracts package has none). Onboarding
therefore ships against a **simulation layer** exactly like the auth stub:
server actions with Zod validation + a deterministic in-memory store, plus a
client-side localStorage draft that owns resume. The transport contract in
`lib/onboarding/contract.ts` is the handoff artifact for the wedding-domain
owner (real `/weddings` API, tenant provisioning, server-side draft).

Goal metric: minimum path = 9 required inputs (2 pre-filled defaults) across
3 short screens → comfortably under 10 minutes.

## 2. Route and entry

- Route: `/mulai` (Indonesian, consistent with `/masuk`, `/daftar`).
- Post-auth contract target; nothing links to it yet (no dashboard) — same
  accepted pattern as `/daftar` before MVP-UI-005.
- Optional `?template=` param accepted, validated (must be an active template
  id), preserved to the completion screen and forwarded to `/editor?template=`
  — future-proofs the catalog → daftar → mulai → editor chain. Invalid/absent
  → ignored silently.

## 3. Step structure (3 steps, one screen each, single route, client state)

| # | Title | Fields | Actions |
|---|---|---|---|
| 1 | Mempelai | nama mempelai 1*, nama mempelai 2*, tanggal pernikahan (opsional + "belum ditentukan" toggle) | [Simpan & lanjut] |
| 2 | Acara pertama | jenis acara*, tanggal acara*, waktu acara*, kota*, zona waktu* (default WIB), nama venue*, alamat (opsional, terungkap setelah venue diisi) | [Kembali] [Simpan & lanjut] |
| 3 | Preferensi | bahasa undangan* (default id) + ringkasan (read-only, with "ubah" links back) | [Kembali] [Selesai] |

- Steps are client state (no `?step=` URL param). Refresh restores position from
  the draft; browser-back leaves the flow with data autosaved (resume banner on
  return). Simpler bundle, deterministic resume.
- Timezone sits with city (one "where" answer), not in preferences.

## 4. Field-level specification

| Field | Step | Control | Attributes | Required | Default |
|---|---|---|---|---|---|
| Nama mempelai pertama | 1 | Input text | autocapitalize=words, maxlength=100 | Ya | — |
| Nama mempelai kedua | 1 | Input text | autocapitalize=words, maxlength=100 | Ya | — |
| Tanggal pernikahan | 1 | Input type=date | min=hari ini | Opsional | kosong |
| "Tanggal belum ditentukan" | 1 | Checkbox | — | toggle | unchecked |
| Jenis acara | 2 | Select | options: Akad Nikah, Resepsi, Unduh Mantu, Lainnya | Ya | Akad Nikah |
| Tanggal acara | 2 | Input type=date | min=hari ini | Ya | — |
| Waktu acara | 2 | Input type=time | — | Ya | — |
| Kota | 2 | Input text | autocomplete=address-level2, autocapitalize=words, maxlength=100 | Ya | — |
| Zona waktu | 2 | Select | WIB (Asia/Jakarta), WITA (Asia/Makassar), WIT (Asia/Jayapura) | Ya | Asia/Jakarta |
| Nama venue | 2 | Input text | autocapitalize=words, maxlength=150 | Ya | — |
| Alamat | 2 | Textarea rows=3 | autocomplete=street-address, maxlength=500, revealed after venue non-empty | Opsional | kosong |
| Bahasa undangan | 3 | Select | Bahasa Indonesia (id), English (en) | Ya | id |

Labels follow the UI kit: required shows "(wajib)"; optional fields are labeled
"(opsional)" with hint "Bisa dilengkapi nanti dari editor." (address) and
"Bisa dilewati jika belum pasti." (wedding date).

## 5. Validation (server action per step — the action is the validator)

| Rule | Error message (id) |
|---|---|
| Nama 1 kosong/whitespace | "Masukkan nama mempelai pertama." |
| Nama 2 kosong | "Masukkan nama mempelai kedua." |
| Nama >100 karakter | "Nama maksimal 100 karakter." |
| Tanggal pernikahan < hari ini (jika diisi) | "Tanggal pernikahan tidak boleh di masa lalu." |
| Jenis acara kosong | "Pilih jenis acara." |
| Tanggal acara kosong/tidak valid | "Masukkan tanggal acara." |
| Tanggal acara < hari ini | "Tanggal acara tidak boleh di masa lalu." |
| Waktu acara kosong | "Masukkan waktu acara." |
| Kota kosong | "Masukkan kota acara." |
| Zona waktu bukan salah satu dari 3 nilai IANA | "Pilih zona waktu." |
| Nama venue kosong | "Masukkan nama venue." |
| Alamat >500 karakter | "Alamat maksimal 500 karakter." |
| Bahasa bukan id/en | "Pilih bahasa undangan." |

- Today is allowed (boundary). Step validation is scoped to that step's fields.
- No cross-field coupling in MVP (wedding date vs event date may differ:
  resepsi can follow the akad). Noted for the real API: "end after start" and
  event-ordering rules belong to the wedding domain, not this form.
- Client shows `noValidate` (auth pattern): errors render only after a failed
  save; per-field aria-wired errors + one form-level `Alert` (role=alert)
  "Periksa kembali isian Anda." and focus moves to the first invalid field.

## 6. Autosave, save, resume, and failure model

**Client draft (source of truth for resume):**
- Single localStorage key `onboarding-draft-v1` holding all fields + step +
  `version` + `updatedAt`. Debounced write (800ms) on every change.
- On mount: no draft → fresh state; draft present → auto-position to the saved
  step and show a resume banner "Lanjutkan persiapan Anda — terakhir disimpan
  [waktu relatif]" with [Lanjutkan] (dismiss banner, stay) and [Mulai baru]
  (clears draft + server draft, confirm via inline confirmation, not a dialog).
- Completed marker: after completion, returning to `/mulai` shows "Persiapan
  sudah selesai" + [Mulai edit undangan] → `/editor` + [Isi ulang] (clears).

**Server action saves (simulation):**
- `saveStepAction(step, data, version)` → server-side Zod validation →
  in-memory store keyed by draft id → returns `{ok, version}` or error code:
  `VALIDATION`, `STALE_VERSION`, `SAVE_FAILED`, `UNAVAILABLE`.
- Version conflict: draft carries the version of the last successful save; a
  mismatch → STALE_VERSION state: "Draf tersimpan lebih baru. " with
  [Muat ulang draf] / [Timpa dengan isian ini]. (Deterministic fixture:
  venue value `versi-lama` → STALE_VERSION.)
- Save failure/disconnected: inline Alert (role=alert) "Gagal menyimpan.
  Perubahan Anda tetap tersimpan di perangkat ini." + [Coba simpan lagi];
  user stays on the step, nothing is lost. (Fixture: city value
  `gagal-simpan` → SAVE_FAILED; network error → same UI state.)
- Saving state: submit button loading + polite status "Menyimpan…" →
  "Tersimpan." (role=status, never steals focus).
- Completion: `completeAction` performs the final save, clears the draft
  (keeps the completed marker), returns the summary for the completion screen.

⚠️ **SIMULATION ONLY** — the store is in-memory (resets on restart) and
carries no tenant/session. Replacing it with the real `/weddings` API
(tenant-provisioned, authorized per step) is a Security/Tenancy-reviewed
change. Fixture triggers are documented in the stub header like the auth stub.

## 7. Mobile keyboard and navigation behavior

- Native controls everywhere: `type=date` / `type=time` pickers, native
  `<select>` wheels, 16px base font (no iOS zoom), ≥44px targets.
- Text fields: `autocapitalize="words"`; `enterkeyhint` "next" on all but the
  last field of a step, "go"/"done" on the last. Enter submits the step
  (native form behavior — no custom key handling).
- Address textarea: Enter inserts a newline; no enterkeyhint.
- Focus management: step change focuses the step heading (`tabIndex={-1}`);
  validation failure focuses the first invalid field; save status announced
  via role=status without focus moves; resume banner is early in tab order
  but never autofocused.
- Progress header in normal flow (no sticky bar) — nothing can obscure
  focused content; buttons sit in-flow at the end of each step.

## 8. Completion and skip policy

- **Skippable:** wedding date (checkbox stores an explicit "undecided" state,
  not a silent empty); address (empty allowed, hint "bisa dilengkapi nanti").
- **Not skippable:** both names, event type/date/time, city, timezone, venue,
  locale — these are the editor's minimum render inputs. Defaults (timezone
  WIB, locale id, type Akad Nikah) reduce effort rather than blocking.
- No step-skip and no "jump to editor": all three screens are required but
  each is <1 minute.
- Completion screen: "Persiapan selesai" + read-only summary card rendering
  the event in the chosen locale and timezone via `Intl.DateTimeFormat`
  ("Akad Nikah — Sabtu, 21 Maret 2026 pukul 08.00 WIB — Nama Venue, Kota") +
  [Mulai edit undangan] → `/editor` (contract target; 404 until MVP-UI-008,
  same accepted pattern as `/daftar` pre-auth) + [Lihat koleksi desain] →
  `/templates`.

## 9. Accessibility and responsive commitments

Per task §8–9: landmarks + one h1 per screen; full keyboard path (skip link →
logo → progress → banner → fields → actions); visible focus; aria-wired
errors; role=status for save states; no color-only indicators; no essential
motion; 320–1440 reflow; long-content and 200% zoom checks.

## 10. Exact files

```
apps/customer-web/src/lib/onboarding/contract.ts           Zod step schemas, error codes/messages, transport types
apps/customer-web/src/lib/onboarding/contract.test.ts
apps/customer-web/src/lib/onboarding/stub-transport.ts     ⚠️ SIMULATION ONLY (store, version, fixtures)
apps/customer-web/src/lib/onboarding/actions.ts            "use server" saveStep/complete/loadState
apps/customer-web/src/lib/onboarding/draft-store.ts        localStorage draft (injectable storage, pure helpers)
apps/customer-web/src/lib/onboarding/draft-store.test.ts
apps/customer-web/src/components/onboarding/onboarding-flow.tsx   client orchestrator
apps/customer-web/src/components/onboarding/onboarding-progress.tsx
apps/customer-web/src/components/onboarding/step-couple.tsx
apps/customer-web/src/components/onboarding/step-event.tsx
apps/customer-web/src/components/onboarding/step-preferences.tsx
apps/customer-web/src/components/onboarding/summary-card.tsx
apps/customer-web/src/components/onboarding/resume-banner.tsx
apps/customer-web/src/components/onboarding/save-status.tsx
apps/customer-web/src/app/mulai/page.tsx
apps/customer-web/src/app/onboarding.css
```

Reuses `AuthShell` chrome (skip link, logo, centered card) and @wedding/ui
form primitives. No existing file changes; `next.config` untouched.

## 11. Test plan

- **Unit:** contract validation matrix (empty/invalid/boundary dates incl.
  today); draft-store round-trip, version bump, clear; stub determinism.
- **E2E (if browser suites are in scope):** full happy path; back preserves
  input; refresh resumes; undecided date toggle; optional address skip;
  validation messages; fixture-triggered save-failed and stale-version
  states; completion summary rendering; keyboard order; noindex not needed
  (public route post-auth, but no PII in URL).
- **A11y/responsive per task §8–9** — see open decision D8.

## 12. Open decisions requiring approval

- **D1** Route `/mulai`.
- **D2** Simulation layer ships (in-memory server store + localStorage draft),
  real `/weddings` API is the handoff — Security/Tenancy review before any
  real persistence.
- **D3** Future-only dates (today allowed) for both wedding and event dates.
- **D4** Timezone grouped with city on step 2 (not in preferences).
- **D5** Completion exits to `/editor` (contract target, 404 until
  MVP-UI-008) + secondary `/templates`.
- **D6** Deterministic fixtures for failure states (city `gagal-simpan` →
  SAVE_FAILED; venue `versi-lama` → STALE_VERSION).
- **D7** Bare names only (no Sdr./Sdri. honorifics — editor's job later);
  event types: Akad Nikah, Resepsi, Unduh Mantu, Lainnya.
- **D8** Browser suites: the auth task removed Playwright specs per your
  direction — should this task include e2e/a11y/responsive specs, or unit
  tests + manual QA only?

## 13. Explicitly out of scope (task §5 + plan)

Gallery, story, gifts, guests, vendor, printing, custom domain; full editor;
speculative extra fields (honorifics, second event, end time, maps/geocoding);
forcing all invitation data before editor access.
