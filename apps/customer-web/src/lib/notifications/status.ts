import {
  PrismaNotificationStatusRepository,
  type NotificationStatusDto,
} from "@wedding/database";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";

/**
 * Delivery status for the session workspace's transactional messages.
 *
 * The tenant comes from the session, never from the request. Recipient contact
 * values are not part of the DTO, so the page cannot leak them even by accident.
 */

export type NotificationStatusLoad =
  | Readonly<{ kind: "ok"; rows: readonly NotificationStatusDto[] }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>;

export async function loadNotificationStatus(): Promise<NotificationStatusLoad> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "unauthenticated" };

  try {
    const rows = await new PrismaNotificationStatusRepository().listForTenant({
      tenantId: workspace.context.tenantId,
    });
    return { kind: "ok", rows };
  } catch {
    return { kind: "unavailable" };
  }
}
