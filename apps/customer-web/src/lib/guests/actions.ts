"use server";

import { randomUUID } from "node:crypto";
import { PrismaGuestRosterRepository } from "@wedding/database";
import { hasAnyRole } from "@wedding/application";
import {
  GUEST_READ_ROLES,
  GUEST_IMPORT_MAX_ROWS,
  GUEST_WRITE_ROLES,
  type GuestExportOutcome,
  type GuestFormOptionsOutcome,
  type GuestImportOutcome,
  type GuestLinkOutcome,
  type GuestMutationOutcome,
} from "./outcomes";
import { guestRequestScope } from "./request";
import {
  guestExportInputSchema,
  guestHouseholdCreateSchema,
  guestHouseholdUpdateSchema,
  guestImportRowsSchema,
  serializeGuestRosterCsv,
} from "./contract";

/**
 * Guest roster Server Actions.
 *
 * Every action resolves its own session scope and re-checks the role, so a client
 * that skips the UI's disabled state still cannot write. The household id and the
 * mutation body are both validated server-side; the raw body never reaches the
 * repository.
 *
 * Members are sent whole on every save and the repository replaces the collection.
 * That is deliberate: the form has no stable member identity across edits, and
 * `Rsvp` keys on `[householdId, eventId]` with no relation to `Guest`, so replacing
 * members cannot disturb an existing response.
 *
 * Note that the return and constant types live in `./outcomes`: a `"use server"`
 * module may only export async functions.
 */

async function rosterScope(): Promise<
  | Readonly<{
      kind: "ok";
      tenantId: string;
      weddingId: string;
      actorId: string;
    }>
  | Readonly<{ kind: "forbidden" }>
> {
  const { request } = await guestRequestScope();
  if (request === null) return { kind: "forbidden" };
  if (!hasAnyRole(request.context, GUEST_WRITE_ROLES)) {
    return { kind: "forbidden" };
  }

  const { resolveSessionWorkspaceOrNull } =
    await import("../workspace/session-workspace");
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "forbidden" };

  return {
    kind: "ok",
    tenantId: workspace.context.tenantId,
    weddingId: workspace.weddingId,
    actorId: request.context.actorId,
  };
}

export async function createGuestHouseholdAction(
  input: unknown,
): Promise<GuestMutationOutcome> {
  const parsed = guestHouseholdCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "invalid",
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const scope = await rosterScope();
  if (scope.kind !== "ok") return { kind: "forbidden" };

  try {
    const created = await new PrismaGuestRosterRepository().create(
      { tenantId: scope.tenantId, weddingId: scope.weddingId },
      {
        displayName: parsed.data.displayName,
        maximumPax: parsed.data.maximumPax,
        members: parsed.data.members.map((member) => ({
          displayName: member.displayName,
          category: member.category,
        })),
      },
    );
    if (created === null) return { kind: "not-found" };
    return { kind: "ok", householdId: created.id };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function updateGuestHouseholdAction(
  householdId: string,
  input: unknown,
): Promise<GuestMutationOutcome> {
  if (typeof householdId !== "string" || householdId.trim() === "") {
    return { kind: "not-found" };
  }

  const parsed = guestHouseholdUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "invalid",
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const scope = await rosterScope();
  if (scope.kind !== "ok") return { kind: "forbidden" };

  try {
    const updated = await new PrismaGuestRosterRepository().update(
      { tenantId: scope.tenantId, weddingId: scope.weddingId },
      householdId,
      {
        displayName: parsed.data.displayName,
        maximumPax: parsed.data.maximumPax,
        members: parsed.data.members.map((member) => ({
          displayName: member.displayName,
          category: member.category,
        })),
      },
    );
    if (updated === null) return { kind: "not-found" };
    return { kind: "ok", householdId: updated.id };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * Issues a fresh personalized link. The plaintext is returned exactly once, and only
 * its hash is stored, so the caller has to show it immediately or lose it.
 */
export async function rotateGuestLinkAction(
  householdId: string,
): Promise<GuestLinkOutcome> {
  if (typeof householdId !== "string" || householdId.trim() === "") {
    return { kind: "not-found" };
  }

  const scope = await rosterScope();
  if (scope.kind !== "ok") return { kind: "forbidden" };

  try {
    const rotated = await new PrismaGuestRosterRepository().rotateLink(
      { tenantId: scope.tenantId, weddingId: scope.weddingId },
      householdId,
    );
    if (rotated === null) return { kind: "not-found" };
    return {
      kind: "ok",
      token: rotated.token,
      tokenVersion: rotated.tokenVersion,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function setGuestLinkStatusAction(
  householdId: string,
  status: "ACTIVE" | "DISABLED",
): Promise<GuestMutationOutcome> {
  if (typeof householdId !== "string" || householdId.trim() === "") {
    return { kind: "not-found" };
  }
  if (status !== "ACTIVE" && status !== "DISABLED") {
    return { kind: "invalid", errors: ["Status tautan tidak dikenali."] };
  }

  const scope = await rosterScope();
  if (scope.kind !== "ok") return { kind: "forbidden" };

  try {
    const updated = await new PrismaGuestRosterRepository().setLinkStatus(
      { tenantId: scope.tenantId, weddingId: scope.weddingId },
      householdId,
      status,
    );
    return updated ? { kind: "ok", householdId } : { kind: "not-found" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function exportGuestRosterAction(
  input: unknown = {},
): Promise<GuestExportOutcome> {
  const parsed = guestExportInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "invalid",
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const scope = await rosterScope();
  if (scope.kind !== "ok") return { kind: "forbidden" };

  try {
    const result = await new PrismaGuestRosterRepository().exportRoster(
      { tenantId: scope.tenantId, weddingId: scope.weddingId },
      {
        ...(parsed.data.householdIds === undefined
          ? {}
          : { householdIds: parsed.data.householdIds }),
        actorId: scope.actorId,
        correlationId: randomUUID(),
      },
    );
    if (result === null) return { kind: "not-found" };

    const timestamp = new Date().toISOString().slice(0, 10);
    return {
      kind: "ok",
      filename: `daftar-tamu-${timestamp}.csv`,
      contentType: "text/csv;charset=utf-8",
      csv: serializeGuestRosterCsv(result.rows),
      householdCount: result.householdCount,
      guestCount: result.guestCount,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function importGuestHouseholdsAction(
  rows: unknown,
): Promise<GuestImportOutcome> {
  if (!Array.isArray(rows)) {
    return { kind: "invalid", errors: ["Data impor tidak dapat dibaca."] };
  }
  if (rows.length === 0) {
    return { kind: "invalid", errors: ["Tidak ada baris yang dipilih."] };
  }
  // Bounded so a crafted body cannot turn one request into an unbounded write.
  if (rows.length > GUEST_IMPORT_MAX_ROWS) {
    return {
      kind: "invalid",
      errors: [`Impor dibatasi ${GUEST_IMPORT_MAX_ROWS} baris sekali jalan.`],
    };
  }

  const parsed = guestImportRowsSchema.safeParse(rows);
  if (!parsed.success) {
    return {
      kind: "invalid",
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const scope = await rosterScope();
  if (scope.kind !== "ok") return { kind: "forbidden" };

  try {
    const result = await new PrismaGuestRosterRepository().createMany(
      { tenantId: scope.tenantId, weddingId: scope.weddingId },
      parsed.data,
    );
    if (result === null) return { kind: "unavailable" };
    return {
      kind: "ok",
      createdHouseholds: result.createdHouseholds,
      createdGuests: result.createdGuests,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Read-only helper for the create/edit forms. */
export async function loadGuestFormOptions(): Promise<GuestFormOptionsOutcome> {
  const { request } = await guestRequestScope();
  if (request === null) return { kind: "forbidden" };
  if (!hasAnyRole(request.context, GUEST_READ_ROLES)) {
    return { kind: "forbidden" };
  }

  try {
    const { resolveSessionWorkspaceOrNull } =
      await import("../workspace/session-workspace");
    const workspace = await resolveSessionWorkspaceOrNull();
    if (workspace === null) return { kind: "forbidden" };

    const overview = await new PrismaGuestRosterRepository().loadOverview({
      tenantId: workspace.context.tenantId,
      weddingId: workspace.weddingId,
    });
    const eventNames = overview.events.map((event) => event.title);
    return {
      kind: "ok",
      events: overview.events.map((event) => ({
        id: event.id,
        title: event.title,
      })),
      // The import review checks each row against the households already on file,
      // so the wizard can flag a duplicate instead of creating one.
      households: overview.households.map((household) => ({
        id: household.id,
        displayName: household.displayName,
        memberCount: household.memberCount,
        maximumPax: household.maximumPax,
        eventNames,
        tags: [],
        linkStatus: household.linkStatus,
        updatedAt: household.updatedAt.toISOString(),
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
