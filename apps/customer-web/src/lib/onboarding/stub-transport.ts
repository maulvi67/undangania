/**
 * ⚠️ SIMULATION ONLY — MVP-UI-006 stub transport. ⚠️
 *
 * This module implements the onboarding transport contract with a
 * DETERMINISTIC IN-MEMORY store so the flow UI can be built, demoed, and
 * tested before the real `/weddings` API exists. It:
 *
 *   - stores drafts in process memory (resets on every server restart),
 *   - is shared across all visitors of a dev server,
 *   - carries NO tenant, session, or authorization of any kind.
 *
 * Replacing it with the real tenant-provisioned `/weddings` API (draft
 * persisted per tenant, authorized per step) is a Security/Tenancy-reviewed,
 * human-approved change (AGENTS.md high-risk list). Until then, no route
 * served by this transport may be described as production-persistence.
 *
 * Fixture surface (D6, documented for tests and demos):
 *   nilai kota   "gagal-simpan"  → SAVE_FAILED    (status coba-lagi)
 *   nilai venue   "versi-lama"    → STALE_VERSION  (panel konflik; versi
 *     tersimpan + 1, data tersimpan = draf di memori)
 *   versi basis tidak cocok        → STALE_VERSION (konflik asli)
 *   selain itu                     → simpan nyata: versi +1, gabung patch
 */

import {
  createInitialData,
  type CompleteResult,
  type OnboardingData,
  type SaveStepResult,
  type StepId,
  type StepPatch,
  type TransportError,
} from "./contract";

/** Latensi artifisial agar status "Menyimpan…" nyata dan teruji. */
const SIMULATED_DELAY_MS = 400;

type StoredServerDraft = {
  version: number;
  step: StepId;
  data: OnboardingData;
  completed: boolean;
  updatedAt: number;
};

const DRAFTS = new Map<string, StoredServerDraft>();

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
}

/** Gabung patch langkah di atas draf tersimpan (atau nilai awal). */
function mergeDraft(existing: StoredServerDraft | undefined, patch: StepPatch): OnboardingData {
  return { ...createInitialData(), ...(existing?.data ?? {}), ...patch };
}

/** Konflik versi asli: penulis terakhir menang hanya dengan force. */
function staleVersion(existing: StoredServerDraft): TransportError {
  return {
    ok: false,
    code: "STALE_VERSION",
    serverVersion: existing.version,
    serverData: existing.data,
  };
}

export async function stubSaveStep(
  draftId: string,
  step: StepId,
  patch: StepPatch,
  baseVersion: number,
  force: boolean,
): Promise<SaveStepResult> {
  await delay();
  // Fixtures are checked FIRST (D6) — deterministic, before any real logic.
  if (patch.city === "gagal-simpan") return { ok: false, code: "SAVE_FAILED" };
  const existing = DRAFTS.get(draftId);
  if (patch.venueName === "versi-lama") {
    return {
      ok: false,
      code: "STALE_VERSION",
      serverVersion: (existing?.version ?? 0) + 1,
      serverData: existing ? existing.data : createInitialData(),
    };
  }
  if (existing && existing.version !== baseVersion && !force) {
    return staleVersion(existing);
  }
  const version = existing ? existing.version + 1 : 1;
  DRAFTS.set(draftId, {
    version,
    step,
    data: mergeDraft(existing, patch),
    completed: false,
    updatedAt: Date.now(),
  });
  return { ok: true, version };
}

export async function stubCompleteStep(
  draftId: string,
  patch: StepPatch,
  baseVersion: number,
  force: boolean,
): Promise<CompleteResult> {
  await delay();
  const existing = DRAFTS.get(draftId);
  if (existing && existing.version !== baseVersion && !force) {
    return staleVersion(existing);
  }
  const version = existing ? existing.version + 1 : 1;
  const data = mergeDraft(existing, patch);
  DRAFTS.set(draftId, { version, step: 3, data, completed: true, updatedAt: Date.now() });
  return { ok: true, version, data };
}

export function stubGetDraft(
  draftId: string,
): { step: StepId; version: number; data: OnboardingData } | null {
  const existing = DRAFTS.get(draftId);
  if (!existing) return null;
  return { step: existing.step, version: existing.version, data: existing.data };
}
