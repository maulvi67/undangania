import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Guestbook submission.
 *
 * Like RSVP, this is guest-facing: the caller has no session and scope comes from
 * a household resolved from a verified token. The tenant and wedding are read from
 * the household row rather than asserted alongside it, so a caller cannot pair a
 * household with the wrong tenant.
 *
 * A submitted message is stored with `moderationStatus = PENDING` and is never
 * published by this path. That default is the moderation domain's whole premise:
 * a message becomes visible only after a human approves it, so nothing a guest
 * types reaches another guest unreviewed.
 *
 * Idempotency is a deterministic message id derived from the caller's key, so a
 * retry after a timeout resolves to the row the first attempt wrote instead of
 * posting the same greeting twice. `create` under a primary key is what enforces
 * it; the pre-check only avoids paying for a failed insert.
 */

export const GUESTBOOK_MESSAGE_MAX_LENGTH = 500;

export type GuestbookValidationFailure =
  "EMPTY_MESSAGE" | "TOO_LONG" | "CONTROL_CHARACTERS";

export type GuestbookSubmitInput = Readonly<{
  /** Resolved from a verified token; never accepted from a request body. */
  householdId: string;
  message: string;
  idempotencyKey: string;
  /** Fallback greeting when the household has no display name. */
  displayNameFallback: string;
}>;

export type GuestbookSubmitResult =
  | Readonly<{ kind: "success"; messageId: string; submittedAt: Date }>
  | Readonly<{ kind: "replayed"; messageId: string; submittedAt: Date }>
  | Readonly<{ kind: "invalid"; reason: GuestbookValidationFailure }>
  | Readonly<{ kind: "not-found" }>;

const householdSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  displayName: true,
  status: true,
} as const satisfies Prisma.GuestHouseholdSelect;

type HouseholdRow = Prisma.GuestHouseholdGetPayload<{
  select: typeof householdSelect;
}>;

const messageSelect = {
  id: true,
  submittedAt: true,
} as const satisfies Prisma.GuestbookMessageSelect;

type MessageRow = Prisma.GuestbookMessageGetPayload<{
  select: typeof messageSelect;
}>;

export type GuestbookSubmissionClient = Readonly<{
  guestHousehold: {
    findFirst(args: {
      where: Prisma.GuestHouseholdWhereInput;
      select: typeof householdSelect;
    }): Promise<HouseholdRow | null>;
  };
  guestbookMessage: {
    findUnique(args: {
      where: { id: string };
      select: typeof messageSelect;
    }): Promise<MessageRow | null>;
    create(args: {
      data: Prisma.GuestbookMessageUncheckedCreateInput;
      select: typeof messageSelect;
    }): Promise<MessageRow>;
  };
  auditEvent: {
    create(args: { data: Prisma.AuditEventUncheckedCreateInput }): Promise<{
      id: string;
    }>;
  };
}>;

export function adaptGuestbookSubmissionClient(
  client: Pick<
    PrismaClient,
    "guestHousehold" | "guestbookMessage" | "auditEvent"
  >,
): GuestbookSubmissionClient {
  return {
    guestHousehold: {
      findFirst: (args) => client.guestHousehold.findFirst(args),
    },
    guestbookMessage: {
      findUnique: (args) => client.guestbookMessage.findUnique(args),
      create: (args) => client.guestbookMessage.create(args),
    },
    auditEvent: {
      create: (args) => client.auditEvent.create(args),
    },
  };
}

/**
 * Normalizes line endings and rejects empty, oversized, or control-bearing text.
 *
 * Control characters are refused rather than stripped: silently rewriting a
 * guest's words would store something they did not write, and the stripped set is
 * exactly the one that has no legitimate use in a greeting.
 */
export function validateGuestbookSubmission(message: string):
  | Readonly<{ ok: true; value: string }>
  | Readonly<{
      ok: false;
      reason: GuestbookValidationFailure;
    }> {
  const normalized = message.replace(/\r\n?/g, "\n");
  if (normalized.trim().length === 0) {
    return { ok: false, reason: "EMPTY_MESSAGE" };
  }
  if (normalized.length > GUESTBOOK_MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: "TOO_LONG" };
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    return { ok: false, reason: "CONTROL_CHARACTERS" };
  }
  return { ok: true, value: normalized };
}

/**
 * Derives the message id from the caller's idempotency key.
 *
 * The key is a client-supplied string, so it is hashed rather than used directly:
 * that keeps the primary key a fixed shape and stops a caller from writing chosen
 * ids. The same key and household always produce the same id, which is what makes
 * the retry a no-op.
 */
export function guestbookMessageId(
  householdId: string,
  idempotencyKey: string,
): string {
  const digest = createHash("sha256")
    .update(`${householdId}:${idempotencyKey}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  // Shaped as a UUID so the column and any downstream consumer expecting one keep
  // working; the value is a digest, not a random id.
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

/**
 * Applies one submission against an already-open client.
 *
 * Exported so the rules can be exercised against a fake client without a
 * database, matching how the other repositories are tested.
 */
export async function applyGuestbookSubmission(
  client: GuestbookSubmissionClient,
  input: GuestbookSubmitInput,
  now: Date,
  correlationId: string,
): Promise<GuestbookSubmitResult> {
  const validation = validateGuestbookSubmission(input.message);
  if (!validation.ok) return { kind: "invalid", reason: validation.reason };

  const household = await client.guestHousehold.findFirst({
    where: { id: input.householdId },
    select: householdSelect,
  });
  if (household === null) return { kind: "not-found" };
  // A household whose link was disabled or deleted must not be able to post, even
  // if the caller still holds a working token.
  if (household.status !== "ACTIVE") return { kind: "not-found" };

  const id = guestbookMessageId(household.id, input.idempotencyKey);
  const existing = await client.guestbookMessage.findUnique({
    where: { id },
    select: messageSelect,
  });
  if (existing !== null) {
    return {
      kind: "replayed",
      messageId: existing.id,
      submittedAt: existing.submittedAt,
    };
  }

  const created = await client.guestbookMessage.create({
    data: {
      id,
      tenantId: household.tenantId,
      weddingId: household.weddingId,
      householdId: household.id,
      displayName:
        household.displayName.trim() === ""
          ? input.displayNameFallback
          : household.displayName,
      message: validation.value,
      // Explicit rather than relying on the column default, because moderation is
      // the reason this row exists in a pending state at all.
      moderationStatus: "PENDING",
      submittedAt: now,
    },
    select: messageSelect,
  });

  await client.auditEvent.create({
    data: {
      tenantId: household.tenantId,
      actorType: "GUEST",
      action: "GUESTBOOK_SUBMITTED",
      targetType: "GuestbookMessage",
      targetId: created.id,
      // Length, not content: an audit row is retained longer than the request and
      // must not become a second copy of what the guest wrote.
      metadata: {
        messageLength: validation.value.length,
        moderationStatus: "PENDING",
      },
      correlationId,
    },
  });

  return {
    kind: "success",
    messageId: created.id,
    submittedAt: created.submittedAt,
  };
}

/**
 * Both writes plus the audit row go through one transaction, so a message can
 * never exist without the audit entry that moderators triage from.
 */
export class PrismaGuestbookSubmissionTransaction {
  public constructor(private readonly client: PrismaClient = prisma) {}

  public async submit(
    input: GuestbookSubmitInput,
    now: Date,
  ): Promise<GuestbookSubmitResult> {
    return this.client.$transaction((transaction) =>
      applyGuestbookSubmission(
        adaptGuestbookSubmissionClient(transaction),
        input,
        now,
        input.idempotencyKey,
      ),
    );
  }
}
