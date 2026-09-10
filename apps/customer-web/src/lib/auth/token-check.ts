/**
 * Server-side token validation for the email-link landing pages
 * (called directly by server components — not form actions).
 */

import { verifyEmailInputSchema } from "./contract";
import { stubResetPassword, stubVerifyEmail } from "./stub-transport";

export type TokenCheck = { kind: "valid" } | { kind: "expired" } | { kind: "invalid" };

function mapResult(result: Awaited<ReturnType<typeof stubVerifyEmail>>): TokenCheck {
  if (result.ok) return { kind: "valid" };
  if (result.code === "TOKEN_EXPIRED") return { kind: "expired" };
  return { kind: "invalid" };
}

export async function checkVerificationToken(token: string): Promise<TokenCheck> {
  const parsed = verifyEmailInputSchema.safeParse({ token });
  if (!parsed.success) return { kind: "invalid" };
  return mapResult(await stubVerifyEmail(parsed.data));
}

export async function checkResetToken(token: string): Promise<TokenCheck> {
  const parsed = verifyEmailInputSchema.safeParse({ token });
  if (!parsed.success) return { kind: "invalid" };
  // Probe the token with a throwaway valid password; the stub rejects on
  // token validity before any password logic.
  return mapResult(await stubResetPassword({ token: parsed.data.token, password: "x".repeat(8) }));
}
