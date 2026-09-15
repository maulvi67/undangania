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
import { safeRedirectTarget } from "./redirect";
import {
  authenticateAndCreateSession,
  registerAndProvisionAccount,
} from "./server";
import {
  stubRegister,
  stubRequestPasswordReset,
  stubResendVerification,
  stubResetPassword,
  stubSignIn,
} from "./stub-transport";

/**
 * Auth server actions (MVP-UI-005). Every action:
 *   1. normalizes + Zod-validates input server-side (external input rule),
 *   2. calls the (simulated) transport,
 *   3. maps the result to the safe client state machine.
 *
 * No cookies, no sessions, no credentials in logs. `next` is re-validated
 * here before any redirect — the client's copy is never trusted.
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
  const result =
    process.env.NODE_ENV === "production"
      ? await authenticateAndCreateSession(parsed.data)
      : await stubSignIn(parsed.data);
  if (result.ok) {
    redirect(next); // throws NEXT_REDIRECT; useActionState propagates
  }
  // VERIFICATION_REQUIRED also (re)sends the verification email server-side
  // in the development fixture flow. Production notification delivery is a
  // separate provider boundary and never uses fixture email behavior.
  if (
    process.env.NODE_ENV !== "production" &&
    result.code === "VERIFICATION_REQUIRED"
  ) {
    await stubResendVerification(parsed.data);
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

  if (process.env.NODE_ENV === "production") {
    const result = await registerAndProvisionAccount(parsed.data);
    if (result === "unavailable") {
      return { status: "error", fieldErrors: {}, code: "PROVIDER_UNAVAILABLE" };
    }
    // Duplicate and fresh addresses intentionally share this interstitial to
    // preserve anti-enumeration behavior.
    return { status: "done", fieldErrors: {}, emailSentTo: parsed.data.email };
  }

  const result = await stubRegister(parsed.data);
  if (!result.ok) {
    return { status: "error", fieldErrors: {}, code: result.code };
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
  if (process.env.NODE_ENV === "production") {
    return { status: "error", fieldErrors: {}, code: "PROVIDER_UNAVAILABLE" };
  }
  await stubResendVerification(parsed.data);
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
  if (process.env.NODE_ENV === "production") {
    return { status: "error", fieldErrors: {}, code: "PROVIDER_UNAVAILABLE" };
  }
  await stubRequestPasswordReset(parsed.data);
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

  if (process.env.NODE_ENV === "production") {
    return { status: "error", fieldErrors: {}, code: "PROVIDER_UNAVAILABLE" };
  }
  const result = await stubResetPassword(parsed.data);
  if (result.ok) {
    // No auto-login (R6): success lands on a panel that hands off to /masuk.
    return { status: "done", fieldErrors: {} };
  }
  return { status: "error", fieldErrors: {}, code: result.code };
}
