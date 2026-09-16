import { describe, expect, it, vi } from "vitest";
import { resolveSessionWorkspace } from "./session-workspace";

/**
 * `getAuthenticatedRequest` reads the session cookie and hits the database, so it
 * is mocked here: the unit under test is the *derivation* of the workspace from
 * an authenticated request, not the authentication itself.
 */
vi.mock("../auth/server", () => ({
  getAuthenticatedRequest: vi.fn(),
}));

const { getAuthenticatedRequest } = await import("../auth/server");

const request = {
  context: {
    actorId: "user-1",
    sessionId: "session-1",
    tenantId: "tenant-1",
    roles: ["OWNER"] as const,
  },
  user: {
    id: "user-1",
    email: "rani@example.com",
    passwordHash: "hash",
    status: "ACTIVE" as const,
    emailVerifiedAt: new Date("2026-03-01T00:00:00.000Z"),
    mfaEnabled: false,
  },
  membership: {
    id: "membership-1",
    tenantId: "tenant-1",
    userId: "user-1",
    role: "OWNER" as const,
    status: "ACTIVE",
  },
  session: { id: "session-1", userId: "user-1" },
};

function repository(
  overrides: {
    wedding?: unknown;
    invitation?: unknown;
  } = {},
) {
  return {
    resolveForTenant: vi.fn().mockResolvedValue(overrides.wedding ?? null),
    resolveInvitation: vi.fn().mockResolvedValue(overrides.invitation ?? null),
  };
}

describe("resolveSessionWorkspace", () => {
  it("derives the tenant and wedding from the session, never the request", async () => {
    vi.mocked(getAuthenticatedRequest).mockResolvedValue(request as never);
    const repo = repository({
      wedding: {
        weddingId: "wedding-1",
        displayName: "Pernikahan kami",
        onboardingCompletedAt: null,
      },
      invitation: {
        invitationId: "invitation-1",
        slug: "rani-bima-1a2b3c4d",
        status: "DRAFT",
      },
    });

    await expect(resolveSessionWorkspace(repo as never)).resolves.toMatchObject(
      {
        weddingId: "wedding-1",
        invitationId: "invitation-1",
        invitationSlug: "rani-bima-1a2b3c4d",
        onboardingCompleted: false,
        context: {
          tenantId: "tenant-1",
          actorId: "user-1",
          roles: ["OWNER"],
        },
      },
    );

    // The lookup is scoped by the membership's tenant, so a session cannot reach
    // another tenant's wedding.
    expect(repo.resolveForTenant).toHaveBeenCalledWith("tenant-1");
    expect(repo.resolveInvitation).toHaveBeenCalledWith("tenant-1");
  });

  it("reports a signed-out visitor as null without touching the database", async () => {
    vi.mocked(getAuthenticatedRequest).mockResolvedValue(null);
    const repo = repository();

    await expect(resolveSessionWorkspace(repo as never)).resolves.toBeNull();
    expect(repo.resolveForTenant).not.toHaveBeenCalled();
  });

  it("reports a tenant with no wedding as null instead of inventing one", async () => {
    vi.mocked(getAuthenticatedRequest).mockResolvedValue(request as never);
    const repo = repository();

    await expect(resolveSessionWorkspace(repo as never)).resolves.toBeNull();
    expect(repo.resolveInvitation).not.toHaveBeenCalled();
  });

  it("reports a chosen-design absence as a null invitation, not an error", async () => {
    vi.mocked(getAuthenticatedRequest).mockResolvedValue(request as never);
    const repo = repository({
      wedding: {
        weddingId: "wedding-1",
        displayName: "Pernikahan kami",
        onboardingCompletedAt: new Date("2026-03-21T00:00:00.000Z"),
      },
    });

    await expect(resolveSessionWorkspace(repo as never)).resolves.toMatchObject(
      {
        invitationId: null,
        invitationSlug: null,
        onboardingCompleted: true,
      },
    );
  });
});
