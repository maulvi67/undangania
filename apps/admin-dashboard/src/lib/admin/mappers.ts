import type {
  AdminAuditRowDto,
  AdminFailedJobRowDto,
  AdminLifecycleExceptionRowDto,
  AdminPaymentRowDto,
  AdminPrintingRowDto,
  AdminPublicationFailureRowDto,
  AdminSupportRowDto,
  AdminTemplateStatusRowDto,
} from "@wedding/database";
import type {
  AdminDashboard,
  AuditRow,
  DetailItem,
  FailedJobRow,
  LifecycleExceptionRow,
  PaymentRow,
  PrintingRow,
  PublicationFailureRow,
  SupportCaseRow,
  TemplateStatusRow,
} from "./contract";

/**
 * Maps operational rows onto the console's display contract.
 *
 * The repository returns exactly the columns each section has; the console's
 * contract additionally carries a `details` list per row. That list is not stored
 * anywhere — it is a presentation grouping of fields the row already has, so it is
 * derived here from real values.
 *
 * Nothing in this module invents data. Every `DetailItem` is a label over a field
 * that came from the database, and a row that lacks a value omits its entry rather
 * than showing a placeholder.
 */

function detail(label: string, value: string, masked = false): DetailItem {
  return { label, value, masked };
}

/** Drops entries with no value so a missing column never renders as an empty cell. */
function present(items: readonly (DetailItem | null)[]): DetailItem[] {
  return items.filter((item): item is DetailItem => item !== null);
}

function optional(label: string, value: string | null): DetailItem | null {
  return value === null || value === "" ? null : detail(label, value);
}

export function toPaymentRow(dto: AdminPaymentRowDto): PaymentRow {
  return {
    id: dto.id,
    reference: dto.reference,
    severity: dto.severity,
    status: dto.status,
    owner: dto.owner,
    age: dto.age,
    updatedAt: dto.updatedAt,
    orderReference: dto.orderReference,
    paymentReference: dto.paymentReference,
    maskedCustomer: dto.maskedCustomer,
    provider: dto.provider,
    method: dto.method,
    internalStatus: dto.internalStatus,
    providerStatus: dto.providerStatus,
    amountMinor: dto.amountMinor,
    currency: dto.currency,
    reconciliation: dto.reconciliation,
    lastProviderCheck: dto.lastProviderCheck,
    details: present([
      detail("Status internal", dto.internalStatus),
      detail("Status provider", dto.providerStatus),
      detail("Rekonsiliasi", dto.reconciliation),
      optional("Nominal", `${dto.amountMinor} ${dto.currency}`),
    ]),
  };
}

export function toFailedJobRow(dto: AdminFailedJobRowDto): FailedJobRow {
  return {
    id: dto.id,
    reference: dto.reference,
    severity: dto.severity,
    status: dto.status,
    owner: dto.owner,
    age: dto.age,
    updatedAt: dto.updatedAt,
    jobType: dto.jobType,
    queue: dto.queue,
    failureReason: dto.failureReason,
    attempts: dto.attempts,
    firstFailedAt: dto.firstFailedAt,
    lastFailedAt: dto.lastFailedAt,
    retryState: dto.retryState,
    relatedResource: dto.relatedResource,
    details: present([
      detail("Percobaan", String(dto.attempts)),
      detail("State retry", dto.retryState),
      optional("Sumber daya", dto.relatedResource),
    ]),
  };
}

export function toPublicationFailureRow(
  dto: AdminPublicationFailureRowDto,
): PublicationFailureRow {
  return {
    id: dto.id,
    reference: dto.reference,
    severity: dto.severity,
    status: dto.status,
    owner: dto.owner,
    age: dto.age,
    updatedAt: dto.updatedAt,
    invitationReference: dto.invitationReference,
    attemptedVersion: dto.attemptedVersion,
    currentPublishedVersion: dto.currentPublishedVersion,
    failureStage: dto.failureStage,
    failedAt: dto.failedAt,
    previousSnapshotActive: dto.previousSnapshotActive,
    retryState: dto.retryState,
    details: present([
      detail("Tahap gagal", dto.failureStage),
      detail("Versi dicoba", String(dto.attemptedVersion)),
      dto.currentPublishedVersion === null
        ? null
        : detail("Versi publik", String(dto.currentPublishedVersion)),
      detail(
        "Snapshot sebelumnya",
        dto.previousSnapshotActive ? "Masih aktif" : "Tidak aktif",
      ),
    ]),
  };
}

export function toPrintingRow(dto: AdminPrintingRowDto): PrintingRow {
  return {
    id: dto.id,
    reference: dto.reference,
    severity: dto.severity,
    status: dto.status,
    owner: dto.owner,
    age: dto.age,
    updatedAt: dto.updatedAt,
    orderReference: dto.orderReference,
    maskedWorkspace: dto.maskedWorkspace,
    vendor: dto.vendor,
    productionStatus: dto.productionStatus,
    shippingStatus: dto.shippingStatus,
    lastProviderUpdate: dto.lastProviderUpdate,
    stuckFor: dto.stuckFor,
    escalationState: dto.escalationState,
  };
}

export function toSupportCaseRow(dto: AdminSupportRowDto): SupportCaseRow {
  return {
    id: dto.id,
    reference: dto.reference,
    severity: dto.severity,
    status: dto.status,
    owner: dto.owner,
    age: dto.age,
    updatedAt: dto.updatedAt,
    caseId: dto.caseId,
    category: dto.category,
    maskedWorkspace: dto.maskedWorkspace,
    lastResponse: dto.lastResponse,
    escalationState: dto.escalationState,
  };
}

export function toTemplateStatusRow(
  dto: AdminTemplateStatusRowDto,
): TemplateStatusRow {
  return {
    id: dto.id,
    reference: dto.reference,
    severity: dto.severity,
    status: dto.status,
    owner: dto.owner,
    age: dto.age,
    updatedAt: dto.updatedAt,
    templateId: dto.templateId,
    name: dto.name,
    availability: dto.availability,
    version: dto.version,
    packageLink: dto.packageLink,
    readiness: dto.readiness,
    lastChanged: dto.lastChanged,
    reason: dto.reason,
  };
}

export function toLifecycleExceptionRow(
  dto: AdminLifecycleExceptionRowDto,
): LifecycleExceptionRow {
  return {
    id: dto.id,
    reference: dto.reference,
    severity: dto.severity,
    status: dto.status,
    owner: dto.owner,
    age: dto.age,
    updatedAt: dto.updatedAt,
    resourceType: dto.resourceType,
    currentState: dto.currentState,
    expectedState: dto.expectedState,
    impact: dto.impact,
    suggestedAction: dto.suggestedAction,
    lastTransition: dto.lastTransition,
  };
}

export function toAuditRow(dto: AdminAuditRowDto): AuditRow {
  return {
    id: dto.id,
    timestamp: dto.timestamp,
    actor: dto.actor,
    role: dto.role,
    action: dto.action,
    target: dto.target,
    reason: dto.reason,
    result: dto.result,
    correlationId: dto.correlationId,
    masked: dto.masked,
  };
}

/**
 * The console's data sections.
 *
 * Includes `attention` because the view renders it: the queue is derived from the
 * other sections rather than queried on its own, but it is still part of the
 * payload and must satisfy the same contract.
 */
export type AdminSections = Omit<
  AdminDashboard,
  "fixture" | "session" | "freshness"
>;

/**
 * A populated console section.
 *
 * The port returns readonly arrays; the view contract is derived from Zod, which
 * infers mutable ones. The copy reconciles the two at the single place they meet.
 */
export function okSection<TRow>(
  rows: readonly TRow[],
  updatedAt: string,
): Readonly<{ status: "ok"; rows: TRow[]; updatedAt: string }> {
  return { status: "ok", rows: [...rows], updatedAt };
}
