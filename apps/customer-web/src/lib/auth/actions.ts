"use server";

import { redirect } from "next/navigation";
import {
  emailOnlyInputSchema,
  normalizeEmail,
  registerInputSchema,
  resetPasswordInputSchema,
  signInInputSchema,
  type AuthFormState,
} from "./contract";
import {
  AuthRequiredError,
  completePasswordReset,
  requestEmailVerification,
  requestPasswordReset,
} from "@wedding/application";
import { safeRedirectTarget } from "./redirect";
import {
  authenticateAndCreateSession,
  clearSession,
  registerAndProvisionAccount,
} from "./server";
import { getAuthEmailPorts } from "./container";

/**
 * Auth server actions (MVP-UI-005). Every action:
 *   1. normalizes + Zod-validates input server-side (external input rule),
 *   2. calls the real session, repository, and email use-cases,
 *   3. maps the result to the safe client state machine.
 *
 * No credentials in logs. `next` is re-validated here before any redirect —
 * the client's copy is never trusted.
 */

const EMAIL_FIELD_ERROR = "Masukkan alamat email yang valid.";
const PASSWORD_REQUIRED_ERROR = "Masukkan kata sandi Anda.";
const PASSWORD_POLICY_ERROR = "Kata sandi minimal 8 karakter.";

function validationState(
  fieldErrors: AuthFormState["fieldErrors"],
): AuthFormState {
  return { status: "error", fieldErrors, code: "VALIDATION" };
}

/** Builds a field-error record without explicit-undefined keys (exactOptionalPropertyTypes). */
function fieldErrorsOf(
  email: boolean,
  emailMessage: string,
  password: boolean,
  passwordMessage: string,
): AuthFormState["fieldErrors"] {
  return {
    ...(email ? { email: emailMessage } : {}),
    ...(password ? { password: passwordMessage } : {}),
  };
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInInputSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return validationState(
      fieldErrorsOf(
        parsed.error.issues.some((i) => i.path[0] === "email"),
        EMAIL_FIELD_ERROR,
        parsed.error.issues.some((i) => i.path[0] === "password"),
        PASSWORD_REQUIRED_ERROR,
      ),
    );
  }

  const next = safeRedirectTarget(String(formData.get("next") ?? ""));
  const result = await authenticateAndCreateSession(parsed.data);
  if (result.ok) {
    redirect(next); // throws NEXT_REDIRECT; useActionState propagates
  }
  // The sign-in view tells the customer a verification link was sent, so an
  // unverified account (re)issues one here. A delivery failure must not change
  // the response for the same anti-enumeration reason as the resend action.
  if (result.code === "VERIFICATION_REQUIRED") {
    try {
      await requestEmailVerification(
        parsed.data.email,
        getAuthEmailPorts(),
        new Date(),
      );
    } catch {
      // Swallowed deliberately; the customer can request another link.
    }
  }
  return { status: "error", fieldErrors: {}, code: result.code };
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerInputSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return validationState(
      fieldErrorsOf(
        parsed.error.issues.some((i) => i.path[0] === "email"),
        EMAIL_FIELD_ERROR,
        parsed.error.issues.some((i) => i.path[0] === "password"),
        PASSWORD_POLICY_ERROR,
      ),
    );
  }

  const result = await registerAndProvisionAccount(parsed.data);
  if (result === "unavailable") {
    return { status: "error", fieldErrors: {}, code: "PROVIDER_UNAVAILABLE" };
  }
  // The account exists now, so the verification email is issued from the real
  // token repository. A delivery failure must not change the response: duplicate
  // and fresh addresses already share this interstitial, and an error here would
  // also distinguish a known address.
  try {
    await requestEmailVerification(
      parsed.data.email,
      getAuthEmailPorts(),
      new Date(),
    );
  } catch {
    // Swallowed deliberately; the customer can request another link.
  }
  return { status: "done", fieldErrors: {}, emailSentTo: parsed.data.email };
}

export async function resendVerificationAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailOnlyInputSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
  });
  if (!parsed.success) {
    return validationState({ email: EMAIL_FIELD_ERROR });
  }
  // Always reports the same acceptance, whether or not the address exists and
  // whether or not delivery succeeded (R1/R3/R4).
  try {
    await requestEmailVerification(
      parsed.data.email,
      getAuthEmailPorts(),
      new Date(),
    );
  } catch {
    // Swallowed deliberately: surfacing a delivery failure here would reveal
    // which addresses have a pending verification.
  }
  return { status: "done", fieldErrors: {}, emailSentTo: parsed.data.email };
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailOnlyInputSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
  });
  if (!parsed.success) {
    return validationState({ email: EMAIL_FIELD_ERROR });
  }
  try {
    await requestPasswordReset(
      parsed.data.email,
      getAuthEmailPorts(),
      new Date(),
    );
  } catch {
    // Swallowed for the same anti-enumeration reason as the resend above.
  }
  // Always identical success state (R3) — unknown and known emails are
  // indistinguishable in UI, timing, and result.
  return { status: "done", fieldErrors: {}, emailSentTo: parsed.data.email };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordInputSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    const tokenInvalid = parsed.error.issues.some((i) => i.path[0] === "token");
    if (tokenInvalid) {
      // Malformed token is not a field error — surface the dedicated panel.
      return { status: "error", fieldErrors: {}, code: "TOKEN_INVALID" };
    }
    return validationState({ password: PASSWORD_POLICY_ERROR });
  }

  try {
    const outcome = await completePasswordReset(
      { token: parsed.data.token, newPassword: parsed.data.password },
      getAuthEmailPorts(),
      new Date(),
    );
    if (outcome.kind === "reset") {
      // No auto-login (R6): success lands on a panel that hands off to /masuk.
      return { status: "done", fieldErrors: {} };
    }
    if (outcome.kind === "expired-token") {
      return { status: "error", fieldErrors: {}, code: "TOKEN_EXPIRED" };
    }
    if (outcome.kind === "weak-password") {
      return validationState({ password: PASSWORD_POLICY_ERROR });
    }
    return { status: "error", fieldErrors: {}, code: "TOKEN_INVALID" };
  } catch (error) {
    // The token was consumed for an account that no longer exists. Reporting a
    // generic unusable link avoids confirming which it was.
    if (error instanceof AuthRequiredError) {
      return { status: "error", fieldErrors: {}, code: "TOKEN_INVALID" };
    }
    return { status: "error", fieldErrors: {}, code: "PROVIDER_UNAVAILABLE" };
  }
}

/**
 * Ends the customer session and returns to the sign-in page.
 *
 * Session revocation is best-effort — the cookie is always cleared, so a
 * database outage cannot leave a usable session on the device.
 */
export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/masuk");
}
