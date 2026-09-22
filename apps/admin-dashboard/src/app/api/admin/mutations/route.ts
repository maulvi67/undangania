import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  executeAdminMutation,
  type AdminMutationRequest,
  type AdminMutationAction,
} from "@wedding/application";
import {
  PrismaAdminMutationIdempotencyRepository,
  PrismaAdminMutationRepository,
  PrismaAdminPaymentReconciliationRepository,
  createMfaRepositoryFromEnv,
} from "@wedding/database";
import { createMidtransQrisPaymentPortFromEnv } from "@wedding/payments";
import { getAdminAccess } from "../../../../lib/admin/server-auth";
import { toTenantContext } from "@wedding/application";
import { z } from "zod";

const mutationSchema = z
  .object({
    action: z.enum([
      "retry_failed_job",
      "reconcile_payment",
      "recover_publication",
      "moderate_template",
      "escalate_support",
      "escalate_printing",
      "export_audit",
      "reveal_audit",
    ]),
    targetId: z.string().regex(/^[A-Za-z0-9._:@-]{1,128}$/u),
    reason: z.string().trim().min(1).max(500),
    confirmation: z.literal("CONFIRM"),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._~-]{16,128}$/u),
    stepUpCode: z.string().trim().min(1).max(128),
    targetType: z.enum(["notification", "outbox"]).optional(),
    templateVersion: z.string().trim().min(1).max(64).optional(),
    fromStatus: z.string().trim().min(1).max(32).optional(),
    toStatus: z.string().trim().min(1).max(32).optional(),
  })
  .strict();

type RouteError = Readonly<{ status: number; code: string; message: string }>;

function responseFor(
  status: number,
  body: unknown,
  correlationId: string,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-correlation-id": correlationId,
    },
  });
}

function routeError(error: unknown): RouteError {
  if (error instanceof Error && "code" in error) {
    const code = error.code;
    if (typeof code === "string") {
      switch (code) {
        case "AUTH_REQUIRED":
          return { status: 401, code, message: "Authentication is required." };
        case "FORBIDDEN":
          return { status: 403, code, message: "Operation is not permitted." };
        case "INVALID":
          return { status: 400, code, message: error.message };
        case "CONFLICT":
          return { status: 409, code, message: error.message };
        case "NOT_IMPLEMENTED":
          return { status: 501, code, message: error.message };
        case "NOT_FOUND":
          return { status: 404, code, message: error.message };
        case "UNAVAILABLE":
        case "PROVIDER_UNAVAILABLE":
          return { status: 503, code, message: error.message };
        default:
          break;
      }
    }
  }
  return {
    status: 503,
    code: "PROVIDER_UNAVAILABLE",
    message: "Admin operation is temporarily unavailable.",
  };
}

function mutationInput(
  parsed: z.infer<typeof mutationSchema>,
  tenantId: string,
): AdminMutationRequest {
  const input: AdminMutationRequest = {
    action: parsed.action as AdminMutationAction,
    // Tenant-bound actions are deliberately tied to the authenticated admin's
    // membership. Platform actions use null and are authorized in the use-case.
    tenantId:
      parsed.action === "moderate_template" ||
      parsed.action === "export_audit" ||
      parsed.action === "reveal_audit"
        ? null
        : tenantId,
    targetId: parsed.targetId,
    reason: parsed.reason,
    confirmation: parsed.confirmation,
    idempotencyKey: parsed.idempotencyKey,
    stepUpCode: parsed.stepUpCode,
    ...(parsed.targetType === undefined
      ? {}
      : { targetType: parsed.targetType }),
    ...(parsed.templateVersion === undefined
      ? {}
      : { templateVersion: parsed.templateVersion }),
    ...(parsed.fromStatus === undefined
      ? {}
      : { fromStatus: parsed.fromStatus }),
    ...(parsed.toStatus === undefined ? {} : { toStatus: parsed.toStatus }),
  };
  return input;
}

export async function POST(request: Request): Promise<NextResponse> {
  const correlationHeader = request.headers
    .get("x-correlation-id")
    ?.match(/^[A-Za-z0-9._:-]{1,128}$/u)?.[0];
  const correlationId = correlationHeader ?? randomUUID();

  const access = await getAdminAccess();
  if (access.kind !== "authorized") {
    return responseFor(
      access.kind === "unavailable" ? 503 : 401,
      {
        error: { code: "AUTH_REQUIRED", message: "Admin access is required." },
      },
      correlationId,
    );
  }

  const mfa = createMfaRepositoryFromEnv();
  if (mfa === null) {
    return responseFor(
      503,
      {
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "MFA service is not configured for admin operations.",
        },
      },
      correlationId,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return responseFor(
      400,
      { error: { code: "INVALID", message: "Invalid JSON body." } },
      correlationId,
    );
  }
  const parsed = mutationSchema.safeParse(body);
  if (!parsed.success) {
    return responseFor(
      400,
      { error: { code: "INVALID", message: "Invalid admin operation input." } },
      correlationId,
    );
  }

  const context = toTenantContext(
    {
      actorId: access.userId,
      sessionId: "",
      tenantId: access.tenantId,
      roles: ["ADMIN"],
    },
    access.tenantId,
  );

  try {
    const provider = createMidtransQrisPaymentPortFromEnv(process.env);
    const reconciliation =
      provider === null
        ? undefined
        : new PrismaAdminPaymentReconciliationRepository(provider);
    const ports =
      reconciliation === undefined
        ? {
            repository: new PrismaAdminMutationRepository(),
            idempotency: new PrismaAdminMutationIdempotencyRepository(),
            mfa,
          }
        : {
            repository: new PrismaAdminMutationRepository(),
            idempotency: new PrismaAdminMutationIdempotencyRepository(),
            mfa,
            reconciliation,
          };
    const result = await executeAdminMutation(
      context,
      mutationInput(parsed.data, access.tenantId),
      ports,
      {
        environment: "PRODUCTION",
        productionMutationApproved:
          process.env.ADMIN_PRODUCTION_MUTATIONS_APPROVED === "true",
        paymentProductionApproved:
          process.env.ADMIN_PAYMENT_PRODUCTION_APPROVED === "true",
        now: new Date(),
        correlationId,
      },
    );
    return responseFor(200, { data: result }, correlationId);
  } catch (error) {
    const mapped = routeError(error);
    return responseFor(
      mapped.status,
      { error: { code: mapped.code, message: mapped.message } },
      correlationId,
    );
  }
}
