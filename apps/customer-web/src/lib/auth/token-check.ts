import { PrismaAuthTokenRepository } from "@wedding/database";
import { completeEmailVerification } from "@wedding/application";
import { verifyEmailInputSchema } from "./contract";
import { getAuthEmailPorts } from "./container";
import { stubResetPassword, stubVerifyEmail } from "./stub-transport";

/**
 * Server-side token handling for the email-link landing pages.
 *
 * Called directly by server components, not by form actions, because the page
 * must decide what to render before the visitor does anything.
 *
 * The two flows differ on purpose:
 *
 *   - Verification consumes the token on load. Clicking the link *is* the act of
 *     verifying, and the page then states that the account is active — so that
 *     has to be true by the time it renders.
 *   - Reset only inspects. The form still has to be filled in, and a page load is
 *     not consent to spend the link. Mail clients and link scanners prefetch
 *     URLs, so consuming on GET would burn the token before the customer clicked.
 *
 * Development additionally honours the deterministic fixture tokens from
 * `stub-transport.ts`, so the documented fixture URLs keep working without a
 * database. Fixture handling is unreachable in production: the branch is gated on
 * `NODE_ENV` and the fixtures are matched by exact literal.
 */

export type TokenCheck =
  { kind: "valid" } | { kind: "expired" } | { kind: "invalid" };

const FIXTURE_VERIFICATION_TOKENS = new Set([
  "verifikasi-valid-verifikasi-valid",
  "verifikasi-kedaluwarsa-x",
]);

const FIXTURE_RESET_TOKENS = new Set([
  "reset-valid-reset-valid",
  "reset-kedaluwarsa-xxxx",
]);

function isFixtureToken(token: string, fixtures: ReadonlySet<string>): boolean {
  return process.env.NODE_ENV !== "production" && fixtures.has(token);
}

/**
 * Consumes an email-verification token.
 *
 * The `verified` outcome is the only success: the use-case redeems the token and
 * marks the address verified in one step, and it does not create a session (R6),
 * so the visitor still signs in afterwards.
 */
export async function consumeVerificationToken(
  token: string,
): Promise<TokenCheck> {
  const parsed = verifyEmailInputSchema.safeParse({ token });
  if (!parsed.success) return { kind: "invalid" };

  if (isFixtureToken(parsed.data.token, FIXTURE_VERIFICATION_TOKENS)) {
    const fixture = await stubVerifyEmail(parsed.data);
    if (fixture.ok) return { kind: "valid" };
    return fixture.code === "TOKEN_EXPIRED"
      ? { kind: "expired" }
      : { kind: "invalid" };
  }

  try {
    const outcome = await completeEmailVerification(
      { token: parsed.data.token },
      getAuthEmailPorts(),
      new Date(),
    );
    if (outcome.kind === "verified") return { kind: "valid" };
    if (outcome.kind === "expired-token") return { kind: "expired" };
    return { kind: "invalid" };
  } catch {
    // A database outage is reported as invalid rather than valid, so the page
    // never claims an account was verified when the write did not happen.
    return { kind: "invalid" };
  }
}

/**
 * Reports whether a reset token could still be redeemed, without consuming it.
 *
 * Reads through the repository rather than the use-case because the use-case
 * exposes no inspection step by design — it redeems.
 */
export async function checkResetToken(token: string): Promise<TokenCheck> {
  const parsed = verifyEmailInputSchema.safeParse({ token });
  if (!parsed.success) return { kind: "invalid" };

  if (isFixtureToken(parsed.data.token, FIXTURE_RESET_TOKENS)) {
    // Probes with a throwaway policy-passing password; the stub rejects on token
    // validity before any password logic runs.
    const fixture = await stubResetPassword({
      token: parsed.data.token,
      password: "x".repeat(8),
    });
    if (fixture.ok) return { kind: "valid" };
    return fixture.code === "TOKEN_EXPIRED"
      ? { kind: "expired" }
      : { kind: "invalid" };
  }

  try {
    const tokens = new PrismaAuthTokenRepository();
    const inspection = await tokens.inspect({
      token: parsed.data.token,
      type: "PASSWORD_RESET",
      now: new Date(),
    });
    if (inspection.kind === "redeemable") return { kind: "valid" };
    if (inspection.kind === "expired") return { kind: "expired" };
    // `already-used` renders as invalid: a spent link is spent, and saying it was
    // already used would confirm that a token once existed.
    return { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}
