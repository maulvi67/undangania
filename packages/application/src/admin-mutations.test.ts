import { describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@wedding/domain";
import {
  executeAdminMutation,
  type AdminMutationPorts,
  type AdminMutationRepository,
} from "./admin";
import type { MfaPort } from "./mfa";

const NOW = new Date("2026-09-22T09:00:00.000Z");

const ADMIN: TenantContext = {
  tenantId: "tenant-1",
  actorId: "admin-1",
  roles: ["ADMIN"],
};

const REQUEST = {
  action: "recover_publication" as const,
  tenantId: "tenant-1",
  targetId: "publication-1",
  reason: "Pulihkan snapshot yang gagal dipromosikan",
  confirmation: "CONFIRM" as const,
  idempotencyKey: "recover-publication-0001",
  stepUpCode: "123456",
};

function mfa(): { mfa: MfaPort } {
  return {
    mfa: {
      status: vi.fn().mockResolvedValue({
        enabled: true,
        enrolmentPending: false,
        remainingRecoveryCodes: 8,
      }),
      beginEnrolment: vi.fn(),
      confirmEnrolment: vi.fn(),
      verify: vi.fn().mockResolvedValue({ kind: "verified" }),
      redeemRecoveryCode: vi.fn(),
      revoke: vi.fn(),
    },
  };
}

function repository(
  overrides: Partial<AdminMutationRepository> = {},
): AdminMutationRepository {
  return {
    retryFailedJob: vi.fn(),
    moderateTemplate: vi.fn(),
    recoverPublication: vi.fn().mockResolvedValue(true),
    escalateSupport: vi.fn(),
    appendAudit: vi.fn(),
    exportAudit: vi.fn(),
    ...overrides,
  };
}

function ports(
  repositoryPort: AdminMutationRepository = repository(),
): AdminMutationPorts {
  return {
    repository: repositoryPort,
    mfa: mfa().mfa,
    idempotency: {
      claim: vi.fn().mockResolvedValue("claimed"),
    },
  };
}

describe("executeAdminMutation recover_publication", () => {
  it("passes the tenant-bound recovery to the repository and returns completion", async () => {
    const repositoryPort = repository();
    const operationPorts = ports(repositoryPort);

    await expect(
      executeAdminMutation(ADMIN, REQUEST, operationPorts, {
        environment: "SIMULATION",
        productionMutationApproved: false,
        paymentProductionApproved: false,
        now: NOW,
        correlationId: "correlation-1",
      }),
    ).resolves.toMatchObject({
      action: "recover_publication",
      targetId: "publication-1",
      status: "completed",
      auditRecorded: true,
    });

    expect(repositoryPort.recoverPublication).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        targetId: "publication-1",
        now: NOW,
        audit: expect.objectContaining({
          action: "ADMIN_RECOVER_PUBLICATION",
          tenantId: "tenant-1",
          targetType: "InvitationPublication",
        }),
      }),
    );
  });

  it("rejects a platform-wide tenant value before claiming idempotency", async () => {
    const operationPorts = ports();
    const claim = operationPorts.idempotency.claim;

    await expect(
      executeAdminMutation(
        ADMIN,
        { ...REQUEST, tenantId: null },
        operationPorts,
        {
          environment: "SIMULATION",
          productionMutationApproved: false,
          paymentProductionApproved: false,
          now: NOW,
          correlationId: "correlation-2",
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(claim).not.toHaveBeenCalled();
  });

  it("keeps the production approval gate active for the new operation", async () => {
    const operationPorts = ports();

    await expect(
      executeAdminMutation(ADMIN, REQUEST, operationPorts, {
        environment: "PRODUCTION",
        productionMutationApproved: false,
        paymentProductionApproved: false,
        now: NOW,
        correlationId: "correlation-3",
      }),
    ).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
    expect(operationPorts.repository.recoverPublication).not.toHaveBeenCalled();
  });

  it("does not claim an idempotency key when the repository reports a CAS conflict", async () => {
    const repositoryPort = repository({
      recoverPublication: vi.fn().mockResolvedValue(false),
    });
    const operationPorts = ports(repositoryPort);

    await expect(
      executeAdminMutation(ADMIN, REQUEST, operationPorts, {
        environment: "SIMULATION",
        productionMutationApproved: false,
        paymentProductionApproved: false,
        now: NOW,
        correlationId: "correlation-4",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(operationPorts.idempotency.claim).toHaveBeenCalledTimes(1);
  });
});
