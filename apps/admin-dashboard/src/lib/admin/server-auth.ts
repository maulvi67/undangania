import { cookies } from "next/headers";
import {
  PrismaSessionRepository,
  PrismaTenantMembershipRepository,
  PrismaUserAuthRepository,
} from "@wedding/database";

const SESSION_COOKIE_NAME = "ws_session";
const ADMIN_ROLE = "ADMIN" as const;

export type AdminAccess =
  | { kind: "authorized"; userId: string; tenantId: string; mfaEnabled: true }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

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
    if (!user.mfaEnabled) return { kind: "forbidden" };

    await sessions.touch(session.id);
    return {
      kind: "authorized",
      userId: user.id,
      tenantId: membership.tenantId,
      mfaEnabled: true,
    };
  } catch {
    return { kind: "unavailable" };
  }
}
