import { cookies } from "next/headers";
import {
  PrismaSessionRepository,
  PrismaTenantMembershipRepository,
  PrismaUserAuthRepository,
  verifyPassword,
} from "@wedding/database";

const SESSION_COOKIE_NAME = "ws_session";
const ADMIN_ROLE = "ADMIN" as const;

/** Console sessions are intentionally short-lived compared to customer sessions. */
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

export type AdminAccess =
  | { kind: "authorized"; userId: string; tenantId: string; mfaEnabled: boolean }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

export type AdminSignInResult =
  | { ok: true }
  | {
      ok: false;
      code: "INVALID_CREDENTIALS" | "SUSPENDED" | "FORBIDDEN" | "UNAVAILABLE";
    };

function sessionToken(value: string | undefined): string | null {
  if (
    value === undefined ||
    value.length === 0 ||
    value.length > 256 ||
    !/^[A-Za-z0-9._~-]+$/.test(value)
  ) {
    return null;
  }
  return value;
}

/**
 * Console read access: a live session whose user is ACTIVE and whose first
 * active membership is ADMIN. MFA enrolment is reported (`mfaEnabled`) but no
 * longer gates the console itself — operators sign in with email and password.
 * Privileged mutations keep requiring an MFA step-up, enforced by the
 * application layer in `executeAdminMutation`.
 */
export async function getAdminAccess(): Promise<AdminAccess> {
  try {
    const store = await cookies();
    const token = sessionToken(store.get(SESSION_COOKIE_NAME)?.value);
    if (token === null) return { kind: "unauthenticated" };

    const sessions = new PrismaSessionRepository();
    const users = new PrismaUserAuthRepository();
    const memberships = new PrismaTenantMembershipRepository();
    const session = await sessions.findActiveByToken(token);
    if (session === null) return { kind: "unauthenticated" };

    const user = await users.findById(session.userId);
    if (user === null || user.status !== "ACTIVE") {
      return { kind: "forbidden" };
    }
    const membership = (
      await memberships.resolveForUser({ userId: user.id })
    ).find((candidate) => candidate.status === "ACTIVE");
    if (membership === undefined || membership.role !== ADMIN_ROLE) {
      return { kind: "forbidden" };
    }

    await sessions.touch(session.id);
    return {
      kind: "authorized",
      userId: user.id,
      tenantId: membership.tenantId,
      mfaEnabled: user.mfaEnabled,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * Signs an operator in with email and password only and opens a console
 * session. The session is created only after the credentials match, the user
 * is ACTIVE, and an ADMIN membership is proven — a failure never leaves a
 * partial session behind. The caller normalizes the email before validation.
 */
export async function authenticateAdminAndCreateSession(input: {
  email: string;
  password: string;
}): Promise<AdminSignInResult> {
  try {
    const users = new PrismaUserAuthRepository();
    const sessions = new PrismaSessionRepository();
    const memberships = new PrismaTenantMembershipRepository();

    const user = await users.findByEmail(input.email);
    const passwordMatches =
      user === null ? false : await verifyPassword(input.password, user.passwordHash);
    if (user === null || !passwordMatches) {
      return { ok: false, code: "INVALID_CREDENTIALS" };
    }
    if (user.status === "SUSPENDED" || user.status === "DELETED") {
      return { ok: false, code: "SUSPENDED" };
    }

    const membership = (
      await memberships.resolveForUser({ userId: user.id })
    ).find((candidate) => candidate.status === "ACTIVE");
    if (membership === undefined || membership.role !== ADMIN_ROLE) {
      return { ok: false, code: "FORBIDDEN" };
    }

    const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000);
    const created = await sessions.create(user.id, expiresAt);
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, created.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    return { ok: true };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

/**
 * Ends the console session: the stored session row is revoked when it can be
 * resolved, and the cookie is always cleared — a database outage must not leave
 * a usable session cookie on the device. Mirrors the customer app's
 * `clearSession` so both surfaces behave identically.
 */
export async function signOutAdminAndClearSession(): Promise<void> {
  try {
    const store = await cookies();
    const token = sessionToken(store.get(SESSION_COOKIE_NAME)?.value);
    if (token !== null) {
      const sessions = new PrismaSessionRepository();
      const current = await sessions.findActiveByToken(token);
      if (current !== null) await sessions.revokeById(current.id);
    }
  } catch {
    // Cookie removal must still happen if the database is temporarily unavailable.
  }
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
