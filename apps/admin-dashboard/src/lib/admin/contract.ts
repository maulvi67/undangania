import { z } from "zod";

export const ADMIN_FIXTURES = [
  "healthy",
  "attention",
  "provider-unavailable",
  "permission-denied",
  "stale",
  "session-expired",
  "audit-unavailable",
] as const;

export type AdminFixture = (typeof ADMIN_FIXTURES)[number];

export function isAdminFixture(value: string): value is AdminFixture {
  return (ADMIN_FIXTURES as readonly string[]).includes(value);
}

export type AdminRole = "ADMIN" | "FINANCE" | "SUPPORT" | "MODERATOR";
export type Severity = "critical" | "high" | "warning" | "info" | "healthy";
export type SectionStatus = "ok" | "unavailable" | "permission-denied";

export type DetailItem = {
  label: string;
  value: string;
  masked: boolean;
};

const detailItemSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  masked: z.boolean(),
});

const operationalRowSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  severity: z.enum(["critical", "high", "warning", "info", "healthy"]),
  status: z.string().min(1),
  owner: z.string().min(1),
  age: z.string().min(1),
  updatedAt: z.string().datetime(),
});

const sectionPageSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  hasNextPage: z.boolean(),
});

const sectionSchema = <T extends z.ZodType>(rowSchema: T) =>
  z.discriminatedUnion("status", [
    z.object({
      status: z.literal("ok"),
      rows: z.array(rowSchema),
      updatedAt: z.string().datetime(),
      pagination: sectionPageSchema.optional(),
    }),
    z.object({
      status: z.literal("unavailable"),
      message: z.string().min(1),
    }),
    z.object({
      status: z.literal("permission-denied"),
      message: z.string().min(1),
    }),
  ]);

const attentionRowSchema = operationalRowSchema.extend({
  issue: z.string().min(1),
  summary: z.string().min(1),
  suggestedAction: z.string().min(1),
  targetSection: z.string().min(1),
});

const paymentRowSchema = operationalRowSchema.extend({
  orderReference: z.string().min(1),
  paymentReference: z.string().min(1),
  maskedCustomer: z.string().min(1),
  provider: z.string().min(1),
  method: z.literal("QRIS"),
  internalStatus: z.string().min(1),
  providerStatus: z.string().min(1),
  amountMinor: z.string().regex(/^\d+$/),
  currency: z.string().length(3),
  reconciliation: z.string().min(1),
  lastProviderCheck: z.string().datetime(),
  details: z.array(detailItemSchema),
});

const failedJobRowSchema = operationalRowSchema.extend({
  jobType: z.string().min(1),
  queue: z.string().min(1),
  failureReason: z.string().min(1),
  attempts: z.number().int().nonnegative(),
  firstFailedAt: z.string().datetime(),
  lastFailedAt: z.string().datetime(),
  retryState: z.string().min(1),
  relatedResource: z.string().min(1),
  details: z.array(detailItemSchema),
});

const publicationFailureRowSchema = operationalRowSchema.extend({
  invitationReference: z.string().min(1),
  attemptedVersion: z.number().int().positive(),
  currentPublishedVersion: z.number().int().positive().nullable(),
  failureStage: z.string().min(1),
  failedAt: z.string().datetime(),
  previousSnapshotActive: z.boolean(),
  retryState: z.string().min(1),
  details: z.array(detailItemSchema),
});

const printingRowSchema = operationalRowSchema.extend({
  orderReference: z.string().min(1),
  maskedWorkspace: z.string().min(1),
  vendor: z.string().min(1),
  productionStatus: z.string().min(1),
  shippingStatus: z.string().min(1),
  lastProviderUpdate: z.string().datetime(),
  stuckFor: z.string().min(1),
  escalationState: z.string().min(1),
});

const supportCaseRowSchema = operationalRowSchema.extend({
  caseId: z.string().min(1),
  category: z.string().min(1),
  maskedWorkspace: z.string().min(1),
  lastResponse: z.string().min(1),
  escalationState: z.string().min(1),
});

const templateStatusRowSchema = operationalRowSchema.extend({
  templateId: z.string().min(1),
  name: z.string().min(1),
  availability: z.string().min(1),
  version: z.string().min(1),
  packageLink: z.string().min(1),
  readiness: z.string().min(1),
  lastChanged: z.string().datetime(),
  reason: z.string().min(1),
});

const lifecycleExceptionRowSchema = operationalRowSchema.extend({
  resourceType: z.string().min(1),
  currentState: z.string().min(1),
  expectedState: z.string().min(1),
  impact: z.string().min(1),
  suggestedAction: z.string().min(1),
  lastTransition: z.string().datetime(),
});

const auditRowSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  actor: z.string().min(1),
  role: z.string().min(1),
  action: z.string().min(1),
  target: z.string().min(1),
  reason: z.string().min(1),
  result: z.string().min(1),
  correlationId: z.string().min(1),
  masked: z.boolean(),
});

const sessionSchema = z.object({
  environment: z.enum(["SIMULATION", "PRODUCTION"]),
  environmentLabel: z.string().min(1),
  role: z.enum(["ADMIN", "FINANCE", "SUPPORT", "MODERATOR"]),
  roleLabel: z.string().min(1),
  mfaActive: z.boolean(),
  scope: z.string().min(1),
  lastRefreshed: z.string().datetime(),
});

const freshnessSchema = z.object({
  status: z.enum(["fresh", "stale"]),
  message: z.string().min(1),
});

const dashboardQuerySchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  search: z.string().max(100),
});

export const adminDashboardSchema = z.object({
  fixture: z.enum(ADMIN_FIXTURES),
  query: dashboardQuerySchema,
  session: sessionSchema,
  freshness: freshnessSchema,
  attention: sectionSchema(attentionRowSchema),
  payments: sectionSchema(paymentRowSchema),
  failedJobs: sectionSchema(failedJobRowSchema),
  publicationFailures: sectionSchema(publicationFailureRowSchema),
  printing: sectionSchema(printingRowSchema),
  support: sectionSchema(supportCaseRowSchema),
  templates: sectionSchema(templateStatusRowSchema),
  lifecycle: sectionSchema(lifecycleExceptionRowSchema),
  audit: sectionSchema(auditRowSchema),
});

export type AdminDashboard = z.infer<typeof adminDashboardSchema>;
export type AttentionRow = z.infer<typeof attentionRowSchema>;
export type PaymentRow = z.infer<typeof paymentRowSchema>;
export type FailedJobRow = z.infer<typeof failedJobRowSchema>;
export type PublicationFailureRow = z.infer<typeof publicationFailureRowSchema>;
export type PrintingRow = z.infer<typeof printingRowSchema>;
export type SupportCaseRow = z.infer<typeof supportCaseRowSchema>;
export type TemplateStatusRow = z.infer<typeof templateStatusRowSchema>;
export type LifecycleExceptionRow = z.infer<typeof lifecycleExceptionRowSchema>;
export type AuditRow = z.infer<typeof auditRowSchema>;

export type AdminLoad =
  | { kind: "ok"; data: AdminDashboard }
  | { kind: "permission-denied"; message: string }
  | { kind: "session-expired"; message: string }
  | { kind: "unavailable"; message: string };

export const ADMIN_QUERY_DEFAULTS = {
  page: 1,
  limit: 50,
  search: "",
} as const;

export type AdminQuery = {
  page: number;
  limit: number;
  search: string;
};

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminQuery(params: {
  page?: string | string[];
  limit?: string | string[];
  search?: string | string[];
}): AdminQuery {
  const pageValue = firstQueryValue(params.page);
  const limitValue = firstQueryValue(params.limit);
  const searchValue = firstQueryValue(params.search);
  const page = Number(pageValue ?? ADMIN_QUERY_DEFAULTS.page);
  const limit = Number(limitValue ?? ADMIN_QUERY_DEFAULTS.limit);
  const search = (searchValue ?? ADMIN_QUERY_DEFAULTS.search).trim();

  return {
    page:
      Number.isInteger(page) && page >= 1 && page <= 100
        ? page
        : ADMIN_QUERY_DEFAULTS.page,
    limit:
      Number.isInteger(limit) && limit >= 1 && limit <= 50
        ? limit
        : ADMIN_QUERY_DEFAULTS.limit,
    search: search.length <= 100 ? search : search.slice(0, 100),
  };
}

export function parseAdminFixture(
  value: string | string[] | undefined,
): AdminFixture {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate !== undefined && isAdminFixture(candidate)
    ? candidate
    : "attention";
}
