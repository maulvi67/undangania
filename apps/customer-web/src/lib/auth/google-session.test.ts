import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findGoogleUser: vi.fn(),
  provisionGoogleUser: vi.fn(),
  findByEmail: vi.fn(),
  resolveForUser: vi.fn(),
  createSession: vi.fn(),
  hashPassword: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("@wedding/database", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: vi.fn(),
  PrismaOAuthAccountRepository: vi.fn().mockImplementation(() => ({
    findGoogleUser: mocks.findGoogleUser,
    provisionGoogleUser: mocks.provisionGoogleUser,
  })),
  PrismaSessionRepository: vi.fn().mockImplementation(() => ({
    create: mocks.createSession,
  })),
  PrismaTenantMembershipRepository: vi.fn().mockImplementation(() => ({
    resolveForUser: mocks.resolveForUser,
  })),
  PrismaUserAuthRepository: vi.fn().mockImplementation(() => ({
    findByEmail: mocks.findByEmail,
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mocks.setCookie })),
}));

import {
  authenticateGoogleAndCreateSession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "./server";

const identity = {
  providerAccountId: "google-sub-123",
  email: "rani@example.com",
  displayName: "Rani Pratama",
};

const activeUser = {
  id: "user-1",
  email: identity.email,
  passwordHash: "unused-hash",
  status: "ACTIVE" as const,
  emailVerifiedAt: new Date("2026-09-25T00:00:00.000Z"),
  mfaEnabled: false,
};

const ownerMembership = {
  id: "membership-1",
  tenantId: "tenant-1",
  userId: activeUser.id,
  role: "OWNER" as const,
  status: "ACTIVE",
};

beforeEach(() => {
  mocks.findGoogleUser.mockReset();
  mocks.provisionGoogleUser.mockReset();
  mocks.findByEmail.mockReset();
  mocks.resolveForUser.mockReset();
  mocks.createSession.mockReset();
  mocks.hashPassword.mockReset();
  mocks.setCookie.mockReset();
  mocks.hashPassword.mockResolvedValue("hashed-random-password");
  mocks.findGoogleUser.mockResolvedValue(null);
  mocks.findByEmail.mockResolvedValue(null);
  mocks.provisionGoogleUser.mockResolvedValue(activeUser);
  mocks.resolveForUser.mockResolvedValue([ownerMembership]);
  mocks.createSession.mockResolvedValue({ token: "session-token" });
});

describe("authenticateGoogleAndCreateSession", () => {
  it("provisions a new verified customer and creates the standard session", async () => {
    await expect(authenticateGoogleAndCreateSession(identity)).resolves.toEqual(
      {
        ok: true,
      },
    );

    expect(mocks.findByEmail).toHaveBeenCalledWith(identity.email);
    expect(mocks.provisionGoogleUser).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAccountId: identity.providerAccountId,
        email: identity.email,
        displayName: identity.displayName,
        passwordHash: "hashed-random-password",
        verifiedAt: expect.any(Date),
      }),
    );
    expect(mocks.createSession).toHaveBeenCalledWith(
      activeUser.id,
      expect.any(Date),
    );
    expect(mocks.setCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "session-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
      }),
    );
  });

  it("does not auto-link a Google identity to an existing email account", async () => {
    mocks.findByEmail.mockResolvedValue(activeUser);

    await expect(authenticateGoogleAndCreateSession(identity)).resolves.toEqual(
      {
        ok: false,
        code: "ACCOUNT_CONFLICT",
      },
    );

    expect(mocks.provisionGoogleUser).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("uses the linked Google subject for existing users", async () => {
    mocks.findGoogleUser.mockResolvedValue(activeUser);

    await expect(authenticateGoogleAndCreateSession(identity)).resolves.toEqual(
      {
        ok: true,
      },
    );

    expect(mocks.findByEmail).not.toHaveBeenCalled();
    expect(mocks.provisionGoogleUser).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledOnce();
  });

  it("rejects suspended and privileged accounts before creating a session", async () => {
    mocks.findGoogleUser.mockResolvedValue({
      ...activeUser,
      status: "SUSPENDED",
    });
    await expect(authenticateGoogleAndCreateSession(identity)).resolves.toEqual(
      {
        ok: false,
        code: "SUSPENDED",
      },
    );

    mocks.findGoogleUser.mockResolvedValue(activeUser);
    mocks.resolveForUser.mockResolvedValue([
      { ...ownerMembership, role: "ADMIN" },
    ]);
    await expect(authenticateGoogleAndCreateSession(identity)).resolves.toEqual(
      {
        ok: false,
        code: "PRIVILEGED_ACCOUNT",
      },
    );
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
