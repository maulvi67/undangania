import { cookies } from "next/headers";
import {
  PrismaSessionRepository,
  PrismaTenantMembershipRepository,
  PrismaUserAuthRepository,
  type SessionDto,
  type TenantMembershipDto,
  type UserAuthRecord,
} from "@wedding/database";
import {
  hasAnyRole,
  requireAnyRole,
  type MemberRole,
  type RequestAuthContext,
} from "@wedding/application";
import { verifyPassword } from "@wedding/database";
import type { SignInInput } from "./contract";

export const SESSION_COOKIE_NAME = "ws_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const CUSTOMER_ROLES = [
  "OWNER",
  "EDITOR",
  "VIEWER",
] as const satisfies readonly MemberRole[];
const ADMIN_ROLES = ["ADMIN"] as const satisfies readonly MemberRole[];

export type AuthenticatedRequest = Readonly<{
  context: RequestAuthContext;
  user: UserAuthRecord;
  membership: TenantMembershipDto;
  session: SessionDto;
}>;

export type AuthFailure = "missing" | "invalid" | "unavailable" | "forbidden";

export class AuthServiceUnavailableError extends Error {
  public constructor() {
    super("Authentication service unavailable");
    this.name = "AuthServiceUnavailableError";
  }
}

function cookieToken(value: string | undefined): string | null {
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

async function cookieValue(): Promise<string | null> {
  const store = await cookies();
  return cookieToken(store.get(SESSION_COOKIE_NAME)?.value);
}

function isActiveUser(user: UserAuthRecord): boolean {
  return user.status === "ACTIVE";
}

function createContext(
  session: SessionDto,
  membership: TenantMembershipDto,
): RequestAuthContext {
  return {
    actorId: session.userId,
    sessionId: session.id,
    tenantId: membership.tenantId,
    roles: [membership.role],
  };
}

export async function getAuthenticatedRequest(
  allowedRoles: readonly MemberRole[] = CUSTOMER_ROLES,
): Promise<AuthenticatedRequest | null> {
  const token = await cookieValue();
  if (token === null) return null;

  try {
    const sessions = new PrismaSessionRepository();
    const memberships = new PrismaTenantMembershipRepository();
    const users = new PrismaUserAuthRepository();
    const session = await sessions.findActiveByToken(token);
    if (session === null) return null;

    const user = await users.findById(session.userId);
    if (user === null || !isActiveUser(user)) return null;

    const userMemberships = await memberships.resolveForUser({
      userId: user.id,
    });
    const membership = userMemberships.find(
      (candidate) => candidate.status === "ACTIVE",
    );
    if (membership === undefined) return null;

    const context = createContext(session, membership);
    if (!hasAnyRole(context, allowedRoles)) return null;

    await sessions.touch(session.id);
    return { context, user, membership, session };
  } catch {
    // Fail closed without disclosing whether a session or account exists.
    return null;
  }
}

export async function requireCustomerRequest(): Promise<AuthenticatedRequest> {
  const request = await getAuthenticatedRequest(CUSTOMER_ROLES);
  if (request === null) {
    throw new Error("AUTH_REQUIRED");
  }
  return request;
}

export async function requireAdminRequest(): Promise<AuthenticatedRequest> {
  const request = await getAuthenticatedRequest(ADMIN_ROLES);
  if (request === null || !request.user.mfaEnabled) {
    throw new Error("ADMIN_AUTH_REQUIRED");
  }
  requireAnyRole(request.context, ADMIN_ROLES);
  return request;
}

export async function authenticateAndCreateSession(input: SignInInput): Promise<
  | { ok: true }
  | {
      ok: false;
      code:
        | "INVALID_CREDENTIALS"
        | "VERIFICATION_REQUIRED"
        | "SUSPENDED"
        | "PROVIDER_UNAVAILABLE";
    }
> {
  try {
    const users = new PrismaUserAuthRepository();
    const sessions = new PrismaSessionRepository();
    const user = await users.findByEmail(input.email);
    const passwordMatches =
      user === null
        ? false
        : await verifyPassword(input.password, user.passwordHash);

    if (user === null || !passwordMatches)
      return { ok: false, code: "INVALID_CREDENTIALS" };
    if (user.status === "SUSPENDED" || user.status === "DELETED") {
      return { ok: false, code: "SUSPENDED" };
    }
    if (user.emailVerifiedAt === null) {
      return { ok: false, code: "VERIFICATION_REQUIRED" };
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    const created = await sessions.create(user.id, expiresAt);
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, created.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthServiceUnavailableError) {
      return { ok: false, code: "PROVIDER_UNAVAILABLE" };
    }
    return { ok: false, code: "PROVIDER_UNAVAILABLE" };
  }
}

export async function registerAndProvisionAccount(input: {
  email: string;
  password: string;
}): Promise<"done" | "duplicate" | "unavailable"> {
  try {
    const users = new PrismaUserAuthRepository();
    await users.register({
      email: input.email,
      password: input.password,
      displayName: input.email.split("@")[0] ?? "Pengguna Wedding System",
      tenantName: "Workspace pernikahan",
    });
    return "done";
  } catch (error) {
    if (error instanceof Error && error.name === "UserAuthRegistrationError") {
      return "duplicate";
    }
    return "unavailable";
  }
}

export async function clearSession(): Promise<void> {
  const token = await cookieValue();
  if (token !== null) {
    try {
      const sessions = new PrismaSessionRepository();
      const current = await sessions.findActiveByToken(token);
      if (current !== null) await sessions.revokeById(current.id);
    } catch {
      // Cookie removal must still happen if the database is temporarily unavailable.
    }
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
