"use server";

import {
  InvalidInputError,
  StaleVersionError,
  onboardingIssues,
  completeOnboarding,
  loadOnboarding,
  saveOnboardingStep,
  type OnboardingData as ApplicationOnboardingData,
} from "@wedding/application";
import type { TenantContext } from "@wedding/domain";
import {
  coupleStepSchema,
  createInitialData,
  eventStepSchema,
  isEventType,
  isOnboardingField,
  isTimezoneId,
  preferencesStepSchema,
  translateFieldErrors,
  type FieldErrors,
  type FlowState,
  type OnboardingData,
  type StepId,
  type StepPatch,
} from "./contract";
import { getOnboardingPorts } from "./container";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";

/**
 * Onboarding server actions.
 *
 * Every action:
 *   1. resolves the caller's workspace from the session — never from the request
 *      body, so a client cannot address another tenant's wedding,
 *   2. normalizes (trim) + Zod-validates input server-side (the external input
 *      rule; the client's `noValidate` form is never trusted),
 *   3. calls the use-case, which owns role authorization and version discipline,
 *   4. maps the outcome onto the client's {@link FlowState}.
 *
 * Unlike the auth actions these return state instead of redirecting, and the
 * client calls them directly rather than through `useActionState`, because
 * conflict resolution needs to reset flow state.
 */

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseStepId(value: string): StepId | null {
  if (value === "1" || value === "2" || value === "3") {
    return Number(value) as StepId;
  }
  return null;
}

function parseVersion(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/** Raw step fields as they arrive from FormData, before schema validation. */
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
  { ok: true; patch: StepPatch } | { ok: false; fieldErrors: FieldErrors };

function validateStep(step: StepId, formData: FormData): StepValidation {
  const schema =
    step === 1
      ? coupleStepSchema
      : step === 2
        ? eventStepSchema
        : preferencesStepSchema;
  const parsed = schema.safeParse(rawFieldsFromFormData(step, formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: translateFieldErrors(parsed.error.issues),
    };
  }
  // The parsed result is narrowly typed (enums from the schema basis) and
  // complete for the step, so it is directly usable as a controlled patch.
  return { ok: true, patch: parsed.data };
}

/**
 * The wizard's dates are `""` when unset; the application contract models the
 * same absence as `null`. Only those keys differ, so they are converted
 * individually and everything else is carried through untouched.
 */
function toApplicationPatch(
  patch: StepPatch,
): Partial<ApplicationOnboardingData> {
  return {
    ...patch,
    ...(patch.weddingDate === undefined
      ? {}
      : { weddingDate: patch.weddingDate === "" ? null : patch.weddingDate }),
    ...(patch.eventDate === undefined
      ? {}
      : { eventDate: patch.eventDate === "" ? null : patch.eventDate }),
    ...(patch.eventTime === undefined
      ? {}
      : { eventTime: patch.eventTime === "" ? null : patch.eventTime }),
  };
}

/**
 * The reverse, for echoing stored data back into the flow's form state.
 *
 * `eventType` and `timezone` are enums in the wizard but plain strings in the
 * application contract, so they are narrowed through the same guards the form
 * uses. A value outside the allowlist can only come from a row written by an
 * older or newer vocabulary; falling back to the initial choice keeps the
 * controlled inputs populated instead of blanking them.
 */
function toClientData(data: ApplicationOnboardingData): OnboardingData {
  const initial = createInitialData();
  return {
    partner1Name: data.partner1Name,
    partner2Name: data.partner2Name,
    weddingDate: data.weddingDate ?? "",
    weddingDateUndecided: data.weddingDateUndecided,
    eventType: isEventType(data.eventType) ? data.eventType : initial.eventType,
    eventDate: data.eventDate ?? "",
    eventTime: data.eventTime ?? "",
    city: data.city,
    timezone: isTimezoneId(data.timezone) ? data.timezone : initial.timezone,
    venueName: data.venueName,
    venueAddress: data.venueAddress,
    locale: data.locale,
  };
}

/**
 * The furthest step the stored data has actually reached.
 *
 * The step the couple was viewing is not persisted (it is a UI position, and
 * localStorage already owns it), so a reload infers it from content: a stored
 * event means steps 1 and 2 are behind them. Used only to place the form when a
 * conflict forces a reload, where staying on the current step is the goal.
 */
function furthestStep(data: OnboardingData): StepId {
  if (data.eventDate !== "" || data.venueName !== "") return 3;
  if (data.partner1Name !== "" || data.partner2Name !== "") return 2;
  return 1;
}

/** Every failure the couple cannot fix by editing a field reads as "try again". */
const RETRYABLE: FlowState = { kind: "retryable", code: "UNAVAILABLE" };

type WorkspaceDraft = Readonly<{
  context: TenantContext;
  weddingId: string;
  version: number;
  data: ApplicationOnboardingData;
  completed: boolean;
}>;

/**
 * Resolves the session's workspace and loads the authoritative draft.
 *
 * Both the save and the complete path need the draft: its `weddingId` addresses
 * the write, and its version and data are what a conflict is reported against.
 * A signed-out visitor, a tenant without a wedding, and a storage failure all
 * collapse to `null` — none of them is something the form can fix.
 */
async function loadWorkspaceDraft(): Promise<WorkspaceDraft | null> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return null;

  try {
    const draft = await loadOnboarding(
      workspace.context,
      { weddingId: workspace.weddingId },
      getOnboardingPorts(),
    );
    return {
      context: workspace.context,
      weddingId: workspace.weddingId,
      version: draft.version,
      data: draft.data,
      completed: draft.completed,
    };
  } catch {
    return null;
  }
}

/**
 * Reports a version conflict along with the data the couple lost to, so the
 * conflict panel can show both versions. `StaleVersionError` deliberately does
 * not carry the row — the caller re-reads rather than the application layer
 * loading data it would otherwise not need.
 */
async function conflictState(): Promise<FlowState> {
  const reloaded = await loadWorkspaceDraft();
  if (reloaded === null) return RETRYABLE;

  return {
    kind: "conflict",
    serverVersion: reloaded.version,
    serverData: toClientData(reloaded.data),
  };
}

export async function saveStepAction(formData: FormData): Promise<FlowState> {
  const stepId = parseStepId(text(formData, "step"));
  const baseVersion = parseVersion(text(formData, "baseVersion"));

  // A malformed envelope can only come from a broken client — reported as
  // retryable rather than crashing. A healthy client always sends the step.
  if (stepId === null) return RETRYABLE;

  const validation = validateStep(stepId, formData);
  if (!validation.ok) {
    return { kind: "error", fieldErrors: validation.fieldErrors };
  }

  const loaded = await loadWorkspaceDraft();
  if (loaded === null) return RETRYABLE;

  try {
    const version = await saveOnboardingStep(
      loaded.context,
      {
        weddingId: loaded.weddingId,
        step: stepId,
        data: toApplicationPatch(validation.patch),
        baseVersion,
      },
      getOnboardingPorts(),
    );
    return { kind: "saved", version, step: stepId };
  } catch (error) {
    if (error instanceof StaleVersionError) return conflictState();
    return RETRYABLE;
  }
}

/**
 * Maps the use-case's completion rules back onto the form's fields.
 *
 * `onboardingIssues` is the same pure function the use-case validates with, and
 * it reports the field that failed, so the couple is pointed at the input that
 * needs attention instead of a generic failure. This runs before the write
 * purely to produce a useful message; the use-case still enforces the rule.
 */
function issuesToFieldErrors(
  data: ApplicationOnboardingData,
): FieldErrors | null {
  const issues = onboardingIssues(data);
  if (issues.length === 0) return null;

  const errors: FieldErrors = {};
  for (const issue of issues) {
    if (!isOnboardingField(issue.field)) continue;
    if (errors[issue.field] !== undefined) continue;
    errors[issue.field] = issue.message;
  }

  return Object.keys(errors).length === 0 ? null : errors;
}

export async function completeAction(formData: FormData): Promise<FlowState> {
  const baseVersion = parseVersion(text(formData, "baseVersion"));

  // Step 3's only input is the locale; steps 1–2 were validated when each was
  // saved, and the stored row supplies whatever the form did not resend.
  const validation = validateStep(3, formData);
  if (!validation.ok) {
    return { kind: "error", fieldErrors: validation.fieldErrors };
  }

  const loaded = await loadWorkspaceDraft();
  if (loaded === null) return RETRYABLE;

  // Completion is judged against the merged server state, not the form: the
  // wizard splits its answers across three steps, so only the stored row knows
  // whether every required field is present.
  const merged: ApplicationOnboardingData = {
    ...loaded.data,
    ...(validation.patch.locale === undefined
      ? {}
      : { locale: validation.patch.locale }),
  };

  if (!loaded.completed) {
    const fieldErrors = issuesToFieldErrors(merged);
    if (fieldErrors !== null) return { kind: "error", fieldErrors };
  }

  try {
    const completed = await completeOnboarding(
      loaded.context,
      { weddingId: loaded.weddingId, data: merged, baseVersion },
      getOnboardingPorts(),
    );
    return {
      kind: "completed",
      version: completed.version,
      data: toClientData(completed.data),
    };
  } catch (error) {
    if (error instanceof StaleVersionError) return conflictState();
    if (error instanceof InvalidInputError) {
      // Reached only if the merge above disagreed with the use-case's own view
      // of the data, which means the row changed underneath this request.
      return conflictState();
    }
    return RETRYABLE;
  }
}

/**
 * Reloads the stored draft so a version conflict can be resolved.
 *
 * The client's draft id is accepted for call-site compatibility but deliberately
 * ignored: the row is resolved from the session, so a client cannot name the
 * record it reloads.
 */
export async function loadDraftAction(
  draftId: string,
): Promise<{ step: StepId; version: number; data: OnboardingData } | null> {
  void draftId;

  const loaded = await loadWorkspaceDraft();
  if (loaded === null) return null;

  const clientData = toClientData(loaded.data);
  return {
    step: furthestStep(clientData),
    version: loaded.version,
    data: clientData,
  };
}
