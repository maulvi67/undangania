"use server";

import { PrismaOversightRepository } from "@wedding/database";
import { hasAnyRole } from "@wedding/application";
import { guestRequestScope } from "../guests/request";
import { GUEST_WRITE_ROLES } from "../guests/outcomes";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";

/**
 * Guestbook moderation.
 *
 * The couple moderates their own invitation, so this is a write the editors may
 * perform. It is scoped by tenant *and* wedding, so a crafted message id cannot
 * decide another wedding's greeting — the repository returns "no match" instead of
 * confirming the row exists elsewhere.
 *
 * No audit row is written: `AuditEvent` is reserved for security-relevant actor
 * actions, and a couple approving a greeting on their own invitation is ordinary
 * product use, already recorded by the message's own status and timestamps.
 */

export type ModerationOutcome =
  | Readonly<{ kind: "ok" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;

const DECISIONS = ["APPROVED", "REJECTED", "HIDDEN"] as const;
type Decision = (typeof DECISIONS)[number];

function isDecision(value: unknown): value is Decision {
  return DECISIONS.some((decision) => decision === value);
}

export async function moderateGuestbookAction(
  messageId: string,
  decision: string,
): Promise<ModerationOutcome> {
  if (typeof messageId !== "string" || messageId.trim() === "") {
    return { kind: "not-found" };
  }
  if (!isDecision(decision)) {
    return { kind: "not-found" };
  }

  const { request } = await guestRequestScope();
  if (request === null) return { kind: "forbidden" };
  if (!hasAnyRole(request.context, GUEST_WRITE_ROLES)) {
    return { kind: "forbidden" };
  }

  try {
    const workspace = await resolveSessionWorkspaceOrNull();
    if (workspace === null) return { kind: "forbidden" };

    const applied = await new PrismaOversightRepository().moderate(
      {
        tenantId: workspace.context.tenantId,
        weddingId: workspace.weddingId,
      },
      messageId,
      decision,
    );
    return applied ? { kind: "ok" } : { kind: "not-found" };
  } catch {
    return { kind: "unavailable" };
  }
}
