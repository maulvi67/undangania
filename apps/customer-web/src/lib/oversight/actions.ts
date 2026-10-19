"use server";

import { randomUUID } from "node:crypto";
import { PrismaOversightRepository } from "@wedding/database";
import { hasAnyRole } from "@wedding/application";
import { z } from "zod";
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

export type RsvpMutationOutcome =
  | Readonly<{ kind: "ok" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid"; message: string }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;

export type RsvpExportOutcome =
  | Readonly<{
      kind: "ok";
      filename: string;
      contentType: string;
      csv: string;
    }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;

const rsvpOverrideSchema = z.object({
  rsvpId: z.string().trim().min(1).max(100),
  response: z.enum(["ATTENDING", "DECLINED", "TENTATIVE"]),
  pax: z.number().int().min(0).max(20),
  reason: z.string().trim().max(500).optional(),
});

const DECISIONS = ["APPROVED", "REJECTED", "HIDDEN", "DELETED"] as const;
type Decision = (typeof DECISIONS)[number];

function isDecision(value: unknown): value is Decision {
  return DECISIONS.some((decision) => decision === value);
}

export async function overrideRsvpAction(
  input: unknown,
): Promise<RsvpMutationOutcome> {
  const parsed = rsvpOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "invalid", message: "Data jawaban tidak valid." };
  }

  const { request } = await guestRequestScope();
  if (request === null) return { kind: "forbidden" };
  if (!hasAnyRole(request.context, GUEST_WRITE_ROLES)) {
    return { kind: "forbidden" };
  }

  try {
    const workspace = await resolveSessionWorkspaceOrNull();
    if (workspace === null) return { kind: "forbidden" };

    const result = await new PrismaOversightRepository().overrideRsvp(
      {
        tenantId: workspace.context.tenantId,
        weddingId: workspace.weddingId,
      },
      {
        rsvpId: parsed.data.rsvpId,
        response: parsed.data.response,
        pax: parsed.data.pax,
        ...(parsed.data.reason === undefined
          ? {}
          : { reason: parsed.data.reason }),
        actorId: request.context.actorId,
        correlationId: randomUUID(),
      },
    );
    if (result.kind === "ok") return result;
    if (result.kind === "not-found") return { kind: "not-found" };
    return {
      kind: "invalid",
      message:
        parsed.data.response === "ATTENDING"
          ? "Jumlah orang harus antara 1 dan batas pax rumah tangga."
          : "Jumlah orang melebihi batas pax atau jawaban sudah berubah.",
    };
  } catch {
    return { kind: "unavailable" };
  }
}

function csvCell(value: string): string {
  const protectedValue = /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export async function exportRsvpAction(): Promise<RsvpExportOutcome> {
  const { request } = await guestRequestScope();
  if (request === null) return { kind: "forbidden" };
  if (!hasAnyRole(request.context, GUEST_WRITE_ROLES)) {
    return { kind: "forbidden" };
  }

  try {
    const workspace = await resolveSessionWorkspaceOrNull();
    if (workspace === null) return { kind: "forbidden" };

    const rows = await new PrismaOversightRepository().exportRsvp(
      {
        tenantId: workspace.context.tenantId,
        weddingId: workspace.weddingId,
      },
      { actorId: request.context.actorId, correlationId: randomUUID() },
    );
    const labels: Record<string, string> = {
      ATTENDING: "Hadir",
      DECLINED: "Tidak hadir",
      TENTATIVE: "Tentatif",
    };
    const lines = ["rumah_tangga,acara,jawaban,jumlah_orang,waktu_jawab"];
    for (const row of rows) {
      lines.push(
        [
          row.householdName,
          row.eventTitle,
          labels[row.response] ?? row.response,
          String(row.pax),
          row.respondedAt.toISOString(),
        ]
          .map(csvCell)
          .join(","),
      );
    }

    return {
      kind: "ok",
      filename: `rsvp-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv;charset=utf-8",
      csv: `${lines.join("\r\n")}\r\n`,
    };
  } catch {
    return { kind: "unavailable" };
  }
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
