"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeAdminRedirectTarget } from "./redirect";
import {
  authenticateAdminAndCreateSession,
  signOutAdminAndClearSession,
} from "./server-auth";

/**
 * Admin console server actions (sign-in and sign-out).
 *
 * Email + password only: the input is normalized then Zod-validated on the
 * server (external input rule), the session is created by the real identity
 * repositories, and `next` is re-validated before any redirect. Error copy is
 * generic for invalid credentials so the form never confirms whether an email
 * is registered. Credentials are never logged.
 */

export type AdminSignInState =
  | { status: "idle" }
  | { status: "error"; message: string };

const adminSignInInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

const INVALID_INPUT_MESSAGE = "Masukkan email dan kata sandi yang valid.";

const ERROR_MESSAGES: Record<
  "INVALID_CREDENTIALS" | "SUSPENDED" | "FORBIDDEN" | "UNAVAILABLE",
  string
> = {
  INVALID_CREDENTIALS: "Email atau kata sandi tidak cocok.",
  SUSPENDED:
    "Akun Anda sedang ditangguhkan. Silakan hubungi dukungan untuk membuka kembali akses.",
  FORBIDDEN: "Akun ini tidak memiliki akses ke konsol admin.",
  UNAVAILABLE:
    "Layanan masuk sedang tidak tersedia. Silakan coba beberapa saat lagi.",
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function adminSignInAction(
  _prev: AdminSignInState,
  formData: FormData,
): Promise<AdminSignInState> {
  const parsed = adminSignInInputSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", message: INVALID_INPUT_MESSAGE };
  }

  const next = safeAdminRedirectTarget(String(formData.get("next") ?? ""));
  const result = await authenticateAdminAndCreateSession(parsed.data);
  if (result.ok) {
    redirect(next); // throws NEXT_REDIRECT; useActionState propagates
  }
  return { status: "error", message: ERROR_MESSAGES[result.code] };
}

/**
 * Ends the console session and returns to the admin sign-in page. Revocation
 * is best-effort — the cookie is always cleared.
 */
export async function adminSignOutAction(): Promise<void> {
  await signOutAdminAndClearSession();
  redirect("/masuk");
}
