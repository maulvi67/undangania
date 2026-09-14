"use server";

import {
  coupleStepSchema,
  eventStepSchema,
  preferencesStepSchema,
  translateFieldErrors,
  type FieldErrors,
  type FlowState,
  type OnboardingData,
  type StepId,
  type StepPatch,
} from "./contract";
import { stubCompleteStep, stubGetDraft, stubSaveStep } from "./stub-transport";

/**
 * Onboarding server actions (MVP-UI-006). Every action:
 *   1. normalizes (trim) + Zod-validates input server-side (external input
 *      rule — the client's noValidate form is never trusted),
 *   2. calls the (simulated) transport,
 *   3. maps the result onto the client FlowState machine.
 *
 * Unlike the auth actions, these return state instead of redirecting, and the
 * client calls them directly (manual state, not useActionState) so conflict
 * resolution can reset flow state (design plan §6).
 */

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseStepId(value: string): StepId | null {
  if (value === "1" || value === "2" || value === "3") return Number(value) as StepId;
  return null;
}

function parseVersion(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/** Isian langkah berjalan dalam bentuk mentah (string dari FormData) — divalidasi skema sebelum dipakai. */
function rawFieldsFromFormData(step: StepId, formData: FormData) {
  if (step === 1) {
    return {
      partner1Name: text(formData, "partner1Name"),
      partner2Name: text(formData, "partner2Name"),
      weddingDate: text(formData, "weddingDate"),
      weddingDateUndecided: formData.get("weddingDateUndecided") === "on",
    };
  }
  if (step === 2) {
    return {
      eventType: text(formData, "eventType"),
      eventDate: text(formData, "eventDate"),
      eventTime: text(formData, "eventTime"),
      city: text(formData, "city"),
      timezone: text(formData, "timezone"),
      venueName: text(formData, "venueName"),
      venueAddress: text(formData, "venueAddress"),
    };
  }
  return { locale: text(formData, "locale") };
}

type StepValidation =
  | { ok: true; patch: StepPatch }
  | { ok: false; fieldErrors: FieldErrors };

function validateStep(step: StepId, formData: FormData): StepValidation {
  const schema =
    step === 1 ? coupleStepSchema : step === 2 ? eventStepSchema : preferencesStepSchema;
  const parsed = schema.safeParse(rawFieldsFromFormData(step, formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: translateFieldErrors(parsed.error.issues) };
  }
  // Hasil parse bertipe sempit (enum di basis skema) dan lengkap per langkah —
  // langsung layak sebagai patch terkontrol.
  return { ok: true, patch: parsed.data };
}

export async function saveStepAction(formData: FormData): Promise<FlowState> {
  const draftId = text(formData, "draftId");
  const stepId = parseStepId(text(formData, "step"));
  const baseVersion = parseVersion(text(formData, "baseVersion"));
  const force = text(formData, "force") === "1";

  // Amplop rusak hanya mungkin dari klien yang rusak — status coba-lagi,
  // bukan crash (klien sehat selalu mengirim draftId + langkah).
  if (draftId === "" || stepId === null) {
    return { kind: "retryable", code: "UNAVAILABLE" };
  }

  const validation = validateStep(stepId, formData);
  if (!validation.ok) return { kind: "error", fieldErrors: validation.fieldErrors };

  const result = await stubSaveStep(draftId, stepId, validation.patch, baseVersion, force);
  if (result.ok) return { kind: "saved", version: result.version, step: stepId };
  if (result.code === "STALE_VERSION") {
    return {
      kind: "conflict",
      serverVersion: result.serverVersion,
      serverData: result.serverData,
    };
  }
  return { kind: "retryable", code: result.code };
}

export async function completeAction(formData: FormData): Promise<FlowState> {
  const draftId = text(formData, "draftId");
  const baseVersion = parseVersion(text(formData, "baseVersion"));
  const force = text(formData, "force") === "1";

  if (draftId === "") {
    return { kind: "retryable", code: "UNAVAILABLE" };
  }

  // Langkah 3: satu-satunya isian adalah locale; data langkah 1–2 sudah
  // tervalidasi pada simpanan masing-masing dan digabung server.
  const validation = validateStep(3, formData);
  if (!validation.ok) return { kind: "error", fieldErrors: validation.fieldErrors };

  const result = await stubCompleteStep(draftId, validation.patch, baseVersion, force);
  if (result.ok) return { kind: "completed", version: result.version, data: result.data };
  if (result.code === "STALE_VERSION") {
    return {
      kind: "conflict",
      serverVersion: result.serverVersion,
      serverData: result.serverData,
    };
  }
  return { kind: "retryable", code: result.code };
}

/** Muat ulang draf server untuk resolusi konflik versi. */
export async function loadDraftAction(
  draftId: string,
): Promise<{ step: StepId; version: number; data: OnboardingData } | null> {
  const id = draftId.trim();
  if (id === "") return null;
  return stubGetDraft(id);
}
