import { loadAdminSection, DEFAULT_ADMIN_LIMIT } from "@wedding/application";
import type { AdminRow, AdminSection } from "@wedding/application";
import type { TenantContext } from "@wedding/domain";
import type { AdminLoad, AttentionRow } from "./contract";
import { getAdminPorts } from "./container";
import {
  okSection,
  toAuditRow,
  toFailedJobRow,
  toLifecycleExceptionRow,
  toPaymentRow,
  toPrintingRow,
  toPublicationFailureRow,
  toSupportCaseRow,
  toTemplateStatusRow,
  type AdminSections,
} from "./mappers";

/**
 * Loads the operations console from the database.
 *
 * Two rules come from the domain and are enforced by `loadAdminSection` rather
 * than repeated here:
 *
 *   - tenant-bound sections require a concrete tenant and read only that tenant;
 *   - platform sections (`failedJobs`, `templates`, `audit`) read across tenants
 *     and are refused unless the caller holds a platform `ADMIN` role *and* asked
 *     for no tenant.
 *
 * The attention queue is not its own port: it is a summary of rows that already
 * need a human, derived from the sections below so the console cannot show an item
 * that no section contains.
 */

const CONSOLE_LIMIT = DEFAULT_ADMIN_LIMIT;

type ConsoleRole = "ADMIN" | "FINANCE" | "SUPPORT" | "MODERATOR";

type LoadedSection<TRow> =
  | Readonly<{ status: "ok"; rows: TRow[]; updatedAt: string }>
  | Readonly<{ status: "unavailable"; message: string }>;

/**
 * The attention queue is derived, not queried.
 *
 * Every entry points at a section that is actually loaded, so following the link
 * always lands on the row. `info` and `healthy` rows are informational and would
 * otherwise drown the queue, so only rows that need a decision are surfaced.
 */
function buildAttention(
  sections: readonly Readonly<{
    rows: readonly AdminRow[];
    targetSection: string;
  }>[],
  now: Date,
): Readonly<{ status: "ok"; rows: AttentionRow[]; updatedAt: string }> {
  const rows: AttentionRow[] = [];

  for (const section of sections) {
    for (const row of section.rows) {
      if (row.severity === "info" || row.severity === "healthy") continue;

      rows.push({
        id: `attention-${row.id}`,
        reference: row.reference,
        severity: row.severity as "critical" | "high" | "warning",
        status: row.status,
        owner: row.owner,
        age: row.age,
        updatedAt: row.updatedAt,
        issue: row.status,
        summary: `${row.owner} · ${row.age}`,
        suggestedAction: "Buka bagian terkait untuk meninjau",
        targetSection: section.targetSection,
      });
    }
  }

  return { status: "ok", rows, updatedAt: now.toISOString() };
}

export async function loadAdminDashboardFromDatabase(input: {
  context: TenantContext;
  /** Null for platform-wide sections; the use-case refuses a scoped platform read. */
  tenantId: string | null;
  now: Date;
  role: ConsoleRole;
  mfaActive: boolean;
  environment: "SIMULATION" | "PRODUCTION";
  environmentLabel: string;
}): Promise<AdminLoad> {
  const ports = getAdminPorts();
  const updatedAt = input.now.toISOString();

  /**
   * Loads one section, giving each caller the mapper matching that section's row
   * shape. A failure is reported per section so one bad section cannot blank the
   * console, and an operator can see which one is missing.
   */
  async function section<TRow>(
    id: AdminSection,
    map: (row: never) => TRow,
  ): Promise<LoadedSection<TRow>> {
    try {
      const rows = await loadAdminSection(
        input.context,
        {
          section: id,
          tenantId: input.tenantId,
          limit: CONSOLE_LIMIT,
          now: input.now,
        },
        ports,
      );
      return okSection(
        rows.map((row) => map(row as never)),
        updatedAt,
      );
    } catch {
      return {
        status: "unavailable",
        message:
          "Bagian ini tidak dapat dibaca saat ini. Bagian lain tetap tersedia.",
      };
    }
  }

  const payments = await section("payments", toPaymentRow);
  const failedJobs = await section("failedJobs", toFailedJobRow);
  const publicationFailures = await section(
    "publicationFailures",
    toPublicationFailureRow,
  );
  const printing = await section("printing", toPrintingRow);
  const support = await section("support", toSupportCaseRow);
  const templates = await section("templates", toTemplateStatusRow);
  const lifecycle = await section("lifecycle", toLifecycleExceptionRow);
  const audit = await section("audit", toAuditRow);

  const actionable = [
    { section: payments, targetSection: "payments" },
    { section: publicationFailures, targetSection: "publication-failures" },
    { section: failedJobs, targetSection: "failed-jobs" },
    { section: lifecycle, targetSection: "lifecycle" },
  ];

  // The queue is only claimed complete when every section it summarises is
  // present; otherwise its absence of items would read as "nothing to do".
  const attention: AdminSections["attention"] = actionable.every(
    (entry) => entry.section.status === "ok",
  )
    ? buildAttention(
        actionable.flatMap((entry) =>
          entry.section.status === "ok"
            ? [{ rows: entry.section.rows, targetSection: entry.targetSection }]
            : [],
        ),
        input.now,
      )
    : {
        status: "unavailable",
        message:
          "Antrian perhatian tidak lengkap karena sebagian bagian tidak dapat dibaca.",
      };

  return {
    kind: "ok",
    data: {
      fixture: "healthy",
      session: {
        environment: input.environment,
        environmentLabel: input.environmentLabel,
        role: input.role,
        roleLabel: roleLabel(input.role),
        mfaActive: input.mfaActive,
        scope: "Operasi, pembayaran, template, audit",
        lastRefreshed: updatedAt,
      },
      freshness: {
        status: "fresh",
        message: "Data dibaca dari workspace pada permintaan terakhir.",
      },
      attention,
      payments,
      failedJobs,
      publicationFailures,
      printing,
      support,
      templates,
      lifecycle,
      audit,
    },
  };
}

function roleLabel(role: ConsoleRole): string {
  switch (role) {
    case "ADMIN":
      return "Platform admin";
    case "FINANCE":
      return "Finance";
    case "SUPPORT":
      return "Support";
    case "MODERATOR":
      return "Moderator";
    default:
      return "Operator";
  }
}
