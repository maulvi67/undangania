import {
  loadAdminSection,
  DEFAULT_ADMIN_LIMIT,
  type AdminSectionPage,
} from "@wedding/application";
import type {
  AdminAuditRow,
  AdminRow,
  AdminSection,
} from "@wedding/application";
import type { TenantContext } from "@wedding/domain";
import type { AdminLoad, AttentionRow, AdminQuery } from "./contract";
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
 * Tenant-bound reads use the authenticated membership tenant. Platform sections
 * are intentionally separate cross-tenant reads and use null only for those
 * sections. A page/search query is bounded and applied to every section so a
 * dashboard request never turns into an unbounded table scan.
 */

const CONSOLE_LIMIT = DEFAULT_ADMIN_LIMIT;

type ConsoleRole = "ADMIN" | "FINANCE" | "SUPPORT" | "MODERATOR";

type LoadedSection<TRow> =
  | Readonly<{
      status: "ok";
      rows: TRow[];
      updatedAt: string;
      pagination: Readonly<{
        page: number;
        limit: number;
        hasNextPage: boolean;
      }>;
    }>
  | Readonly<{ status: "unavailable"; message: string }>;

function pageOffset(query: AdminQuery): number {
  return (query.page - 1) * query.limit;
}

function pageMeta(query: AdminQuery, hasNextPage: boolean) {
  return { page: query.page, limit: query.limit, hasNextPage };
}

function buildAttention(
  sections: readonly Readonly<{
    rows: readonly AdminRow[];
    targetSection: string;
  }>[],
  now: Date,
  query: AdminQuery,
): Readonly<{
  status: "ok";
  rows: AttentionRow[];
  updatedAt: string;
  pagination: Readonly<{
    page: number;
    limit: number;
    hasNextPage: boolean;
  }>;
}> {
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

  return {
    status: "ok",
    rows,
    updatedAt: now.toISOString(),
    pagination: pageMeta(query, false),
  };
}

export async function loadAdminDashboardFromDatabase(input: {
  context: TenantContext;
  tenantId: string;
  now: Date;
  role: ConsoleRole;
  mfaActive: boolean;
  environmentLabel: string;
  query?: AdminQuery;
}): Promise<AdminLoad> {
  const ports = getAdminPorts();
  const updatedAt = input.now.toISOString();
  const query = input.query ?? { page: 1, limit: CONSOLE_LIMIT, search: "" };
  const offset = pageOffset(query);

  async function section<TRow>(
    id: AdminSection,
    tenantId: string | null,
    map: (row: never) => TRow,
  ): Promise<LoadedSection<TRow>> {
    try {
      const result = (await loadAdminSection(
        input.context,
        {
          section: id,
          tenantId,
          limit: query.limit,
          offset,
          ...(query.search.length === 0 ? {} : { search: query.search }),
          now: input.now,
        },
        ports,
      )) as AdminSectionPage<AdminRow> | AdminSectionPage<AdminAuditRow>;

      return okSection(
        result.rows.map((row) => map(row as never)),
        updatedAt,
        pageMeta(query, result.hasNextPage),
      );
    } catch {
      return {
        status: "unavailable",
        message:
          "Bagian ini tidak dapat dibaca saat ini. Bagian lain tetap tersedia.",
      };
    }
  }

  const tenantBound = input.tenantId;
  const platformWide = null;
  const payments = await section("payments", tenantBound, toPaymentRow);
  const failedJobs = await section("failedJobs", platformWide, toFailedJobRow);
  const publicationFailures = await section(
    "publicationFailures",
    tenantBound,
    toPublicationFailureRow,
  );
  const printing = await section("printing", tenantBound, toPrintingRow);
  const support = await section("support", tenantBound, toSupportCaseRow);
  const templates = await section(
    "templates",
    platformWide,
    toTemplateStatusRow,
  );
  const lifecycle = await section(
    "lifecycle",
    tenantBound,
    toLifecycleExceptionRow,
  );
  const audit = await section("audit", platformWide, toAuditRow);

  const actionable = [
    { section: payments, targetSection: "payments" },
    { section: publicationFailures, targetSection: "publication-failures" },
    { section: failedJobs, targetSection: "failed-jobs" },
    { section: lifecycle, targetSection: "lifecycle" },
  ];

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
        query,
      )
    : {
        status: "unavailable",
        message:
          "Antrian perhatian tidak lengkap karena sebagian bagian tidak dapat dibaca.",
      };

  return {
    kind: "ok",
    data: {
      query,
      session: {
        environmentLabel: input.environmentLabel,
        role: input.role,
        roleLabel: roleLabel(input.role),
        mfaActive: input.mfaActive,
        scope: `Operasi tenant ${input.tenantId.slice(0, 2)}*** · platform queue`,
        lastRefreshed: updatedAt,
      },
      freshness: {
        status: "fresh",
        message:
          "Data dibaca dari sumber operasional pada permintaan terakhir.",
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
