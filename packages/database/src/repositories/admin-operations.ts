import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Admin console operational queries.
 *
 * This layer produces the read model behind `AdminDashboard`. Three constraints
 * shape it:
 *
 *   1. Tenant scope. `Payment`, `PrintingOrder`, `SupportCase`, `Notification`
 *      and `OutboxEvent` all carry `tenantId`, and every tenant-bound query
 *      includes it. The platform-wide sections (`failedJobs`, `templates`,
 *      `audit`) accept `tenantId: string | null` and are a deliberate,
 *      audited cross-tenant read that *this repository does not authorize* —
 *      the caller must have already established platform-admin privilege.
 *
 *   2. No PII. `Notification.recipientRefEncrypted` is ciphertext and is never
 *      decrypted here; it is reported as masked. Workspace and customer
 *      identifiers are masked to a stable prefix so an operator can correlate
 *      rows without reading identity.
 *
 *   3. Determinism. Every relative value (`age`, `stuckFor`) is computed from a
 *      caller-supplied `now`, never the wall clock, so the same row yields the
 *      same output in a test and in production.
 *
 * Some contract fields have no backing column. Those are derived, and each
 * derivation is named at the point it happens rather than papered over.
 */

const SEVERITY = {
  critical: "critical",
  high: "high",
  warning: "warning",
  info: "info",
  healthy: "healthy",
} as const;

export type AdminSeverity = (typeof SEVERITY)[keyof typeof SEVERITY];

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Age buckets for `staleness`. Tuned so the "attention" list sorts the way an
 * operator triages: anything past a day is failing to resolve on its own.
 */
export function formatAge(from: Date, now: Date): string {
  return formatDuration(from, now);
}

/**
 * Human-readable duration in Bahasa Indonesia. Deliberately coarse: an operator
 * reading "3 hari" does not need the minutes, and a precise value would make the
 * "attention" list harder to scan.
 */
export function formatDuration(from: Date, until: Date): string {
  const delta = until.getTime() - from.getTime();
  if (delta < 0) return "baru saja";
  if (delta < MINUTE_MS) return "baru saja";
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)} menit`;
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)} jam`;
  return `${Math.floor(delta / DAY_MS)} hari`;
}

/**
 * Masks an identifier so it stays correlatable without being identifying. Keeps
 * the first two characters, which is enough for an operator to match a row
 * against a customer's own reference.
 */
export function maskIdentifier(value: string): string {
  if (value.length === 0) return "***";
  if (value.length <= 2) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 2)}***`;
}

/**
 * Masks an encrypted recipient reference. The ciphertext is never decrypted, so
 * this only demonstrates that a value is present without exposing it.
 */
export function maskRecipientRef(present: boolean): string {
  return present ? "***" : "(tidak ada)";
}

/** BigInt -> decimal string, matching the contract's `/^\d+$/` requirement. */
export function decimalString(value: bigint): string {
  return value.toString();
}

export function isoString(value: Date): string {
  return value.toISOString();
}

/**
 * Severity from an order/payment status pair. `PaymentStatus.FAILED` and
 * `EXPIRED` are the two states an operator must act on, so they rank above a
 * merely incomplete order.
 */
export function severityForPayment(
  input: Readonly<{
    paymentStatus: string;
    orderStatus: string;
  }>,
): AdminSeverity {
  if (input.paymentStatus === "FAILED") return "critical";
  if (input.paymentStatus === "EXPIRED") return "warning";
  if (input.paymentStatus === "PAID") return "healthy";
  if (input.orderStatus === "CANCELLED") return "info";
  return "info";
}

/**
 * `reconciliation` is derived rather than stored: it compares the internal
 * payment status with the provider's own status, which the notification flow
 * writes to `Payment.providerEventId` presence and `paidAt`. A payment that is
 * internally PAID with no `paidAt` has an inconsistent record, and reporting
 * that as "perlu ditinjau" is the honest reading.
 */
export function reconciliationState(
  input: Readonly<{
    paymentStatus: string;
    paidAt: Date | null;
  }>,
): string {
  if (input.paymentStatus === "PAID" && input.paidAt === null) {
    return "perlu ditinjau";
  }
  if (input.paymentStatus === "PAID") return "sesuai";
  return "menunggu";
}

/**
 * `retryState` is derived from `OutboxEvent.attemptCount` against the schema's
 * `@@index([status, attemptCount])` intent: nothing has been tried yet, it is
 * being retried, or it has exhausted the attempts a worker will make.
 */
export function retryStateFor(attemptCount: number): string {
  if (attemptCount === 0) return "belum dicoba";
  if (attemptCount < MAX_DELIVERY_ATTEMPTS) return "dicoba ulang";
  return "berhenti";
}

/**
 * Attempts after which a worker stops retrying. Mirrors the bound the background
 * worker is expected to honour; kept here so the admin console reports the same
 * number the worker acts on.
 */
export const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * `failureStage` is derived from how far the notification got: nothing sent,
 * handed to the provider, or accepted but never confirmed delivered.
 */
export function failureStageFor(
  input: Readonly<{
    attemptCount: number;
    sentAt: Date | null;
    deliveredAt: Date | null;
  }>,
): string {
  if (input.deliveredAt !== null) return "terkirim";
  if (input.sentAt !== null) return "penyedia";
  if (input.attemptCount > 0) return "pengiriman";
  return "antrean";
}

/**
 * `queue` is not persisted. Notifications and outbox events are both drained by
 * the background worker, so the queue an operator sees is the model that owns
 * the row.
 */
export function queueFor(model: "notification" | "outbox"): string {
  return model === "notification" ? "notifikasi" : "peristiwa";
}

/**
 * `printing` has no explicit "stuck" column. A print job is stuck when it has
 * been in a non-terminal status without a provider update for longer than the
 * threshold below, which is the same condition an operator would apply by eye.
 */
const PRINTING_STUCK_AFTER_MS = 3 * DAY_MS;

export function isPrintingStuck(
  input: Readonly<{
    status: string;
    updatedAt: Date;
    now: Date;
  }>,
): boolean {
  if (input.status === "COMPLETED" || input.status === "CANCELLED")
    return false;
  return (
    input.now.getTime() - input.updatedAt.getTime() > PRINTING_STUCK_AFTER_MS
  );
}

export function escalationStateForStuck(stuck: boolean): string {
  return stuck ? "perlu dieskalasi" : "normal";
}

/**
 * Shipping status comes from the most recent `Shipment` row. A printing order
 * with no shipment has not shipped; reporting the order's own status instead
 * would claim progress that has not happened.
 */
export function shippingStatusFor(
  shipments: readonly Readonly<{ status: string }>[],
): string {
  const latest = shipments[0];
  return latest === undefined ? "belum dikirim" : latest.status;
}

// ---------------------------------------------------------------------------
// Selects and row types
// ---------------------------------------------------------------------------

const paymentRowSelect = {
  id: true,
  tenantId: true,
  orderId: true,
  provider: true,
  providerTransactionId: true,
  method: true,
  status: true,
  amountMinor: true,
  currency: true,
  paidAt: true,
  updatedAt: true,
  order: {
    select: {
      orderNumber: true,
      status: true,
      userId: true,
      createdAt: true,
    },
  },
} as const satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentRowSelect }>;

const notificationRowSelect = {
  id: true,
  tenantId: true,
  channel: true,
  templateCode: true,
  status: true,
  attemptCount: true,
  lastError: true,
  sentAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof notificationRowSelect;
}>;

const outboxRowSelect = {
  id: true,
  tenantId: true,
  eventType: true,
  aggregateType: true,
  aggregateId: true,
  status: true,
  attemptCount: true,
  lastError: true,
  lastAttemptAt: true,
  createdAt: true,
} as const satisfies Prisma.OutboxEventSelect;

type OutboxRow = Prisma.OutboxEventGetPayload<{
  select: typeof outboxRowSelect;
}>;

const publicationFailureSelect = {
  id: true,
  tenantId: true,
  invitationId: true,
  publicationVersion: true,
  active: true,
  publishedAt: true,
  publishedBy: true,
  invitation: { select: { slug: true, status: true } },
} as const satisfies Prisma.InvitationPublicationSelect;

type PublicationFailureRow = Prisma.InvitationPublicationGetPayload<{
  select: typeof publicationFailureSelect;
}>;

const printingRowSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  orderId: true,
  status: true,
  quantity: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { businessName: true } },
  shipments: {
    select: { status: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  },
} as const satisfies Prisma.PrintingOrderSelect;

type PrintingOrderRow = Prisma.PrintingOrderGetPayload<{
  select: typeof printingRowSelect;
}>;

const supportCaseSelect = {
  id: true,
  tenantId: true,
  reference: true,
  category: true,
  severity: true,
  status: true,
  owner: true,
  escalationState: true,
  lastResponseAt: true,
  lastResponseBy: true,
  openedAt: true,
  updatedAt: true,
} as const satisfies Prisma.SupportCaseSelect;

type SupportCaseRow = Prisma.SupportCaseGetPayload<{
  select: typeof supportCaseSelect;
}>;

const templateStatusSelect = {
  id: true,
  version: true,
  name: true,
  category: true,
  tier: true,
  status: true,
  licenseStatus: true,
  createdAt: true,
} as const satisfies Prisma.TemplateSelect;

type TemplateStatusRow = Prisma.TemplateGetPayload<{
  select: typeof templateStatusSelect;
}>;

const auditRowSelect = {
  id: true,
  tenantId: true,
  userId: true,
  actorType: true,
  action: true,
  targetType: true,
  targetId: true,
  reason: true,
  correlationId: true,
  createdAt: true,
} as const satisfies Prisma.AuditEventSelect;

type AuditEventRow = Prisma.AuditEventGetPayload<{
  select: typeof auditRowSelect;
}>;

const invitationLifecycleSelect = {
  id: true,
  tenantId: true,
  status: true,
  slug: true,
  updatedAt: true,
} as const satisfies Prisma.InvitationSelect;

type InvitationLifecycleRow = Prisma.InvitationGetPayload<{
  select: typeof invitationLifecycleSelect;
}>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects.
 * A real client is adapted by `adaptAdminOperationsClient` rather than cast into
 * place: Prisma's delegates are generic over `SelectSubset`, so comparing them
 * against a concrete signature is not sound.
 */
type AdminPaymentClient = Readonly<{
  payment: {
    findMany(args: {
      where: Prisma.PaymentWhereInput;
      orderBy: Prisma.PaymentOrderByWithRelationInput;
      take: number;
      select: typeof paymentRowSelect;
    }): Promise<PaymentRow[]>;
  };
}>;

type AdminFailedJobClient = Readonly<{
  notification: {
    findMany(args: {
      where: Prisma.NotificationWhereInput;
      orderBy: Prisma.NotificationOrderByWithRelationInput;
      take: number;
      select: typeof notificationRowSelect;
    }): Promise<NotificationRow[]>;
  };
  outboxEvent: {
    findMany(args: {
      where: Prisma.OutboxEventWhereInput;
      orderBy: Prisma.OutboxEventOrderByWithRelationInput;
      take: number;
      select: typeof outboxRowSelect;
    }): Promise<OutboxRow[]>;
  };
}>;

type AdminPublicationClient = Readonly<{
  invitationPublication: {
    findMany(args: {
      where: Prisma.InvitationPublicationWhereInput;
      orderBy: Prisma.InvitationPublicationOrderByWithRelationInput;
      take: number;
      select: typeof publicationFailureSelect;
    }): Promise<PublicationFailureRow[]>;
  };
}>;

type AdminPrintingClient = Readonly<{
  printingOrder: {
    findMany(args: {
      where: Prisma.PrintingOrderWhereInput;
      orderBy: Prisma.PrintingOrderOrderByWithRelationInput;
      take: number;
      select: typeof printingRowSelect;
    }): Promise<PrintingOrderRow[]>;
  };
}>;

type AdminSupportClient = Readonly<{
  supportCase: {
    findMany(args: {
      where: Prisma.SupportCaseWhereInput;
      orderBy: Prisma.SupportCaseOrderByWithRelationInput;
      take: number;
      select: typeof supportCaseSelect;
    }): Promise<SupportCaseRow[]>;
  };
}>;

type AdminTemplateClient = Readonly<{
  template: {
    findMany(args: {
      where: Prisma.TemplateWhereInput;
      orderBy: Prisma.TemplateOrderByWithRelationInput[];
      take: number;
      select: typeof templateStatusSelect;
    }): Promise<TemplateStatusRow[]>;
  };
}>;

type AdminAuditClient = Readonly<{
  auditEvent: {
    findMany(args: {
      where: Prisma.AuditEventWhereInput;
      orderBy: Prisma.AuditEventOrderByWithRelationInput;
      take: number;
      select: typeof auditRowSelect;
    }): Promise<AuditEventRow[]>;
  };
}>;

type AdminLifecycleClient = Readonly<{
  invitation: {
    findMany(args: {
      where: Prisma.InvitationWhereInput;
      orderBy: Prisma.InvitationOrderByWithRelationInput;
      take: number;
      select: typeof invitationLifecycleSelect;
    }): Promise<InvitationLifecycleRow[]>;
  };
}>;

export type AdminOperationsClient = AdminPaymentClient &
  AdminFailedJobClient &
  AdminPublicationClient &
  AdminPrintingClient &
  AdminSupportClient &
  AdminTemplateClient &
  AdminAuditClient &
  AdminLifecycleClient;

export function adaptAdminOperationsClient(
  client: Pick<
    PrismaClient,
    | "payment"
    | "notification"
    | "outboxEvent"
    | "invitationPublication"
    | "printingOrder"
    | "supportCase"
    | "template"
    | "auditEvent"
    | "invitation"
  >,
): AdminOperationsClient {
  return {
    payment: { findMany: (args) => client.payment.findMany(args) },
    notification: { findMany: (args) => client.notification.findMany(args) },
    outboxEvent: { findMany: (args) => client.outboxEvent.findMany(args) },
    invitationPublication: {
      findMany: (args) => client.invitationPublication.findMany(args),
    },
    printingOrder: { findMany: (args) => client.printingOrder.findMany(args) },
    supportCase: { findMany: (args) => client.supportCase.findMany(args) },
    template: { findMany: (args) => client.template.findMany(args) },
    auditEvent: { findMany: (args) => client.auditEvent.findMany(args) },
    invitation: { findMany: (args) => client.invitation.findMany(args) },
  };
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type AdminPaymentRowDto = Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
  orderReference: string;
  paymentReference: string;
  maskedCustomer: string;
  provider: string;
  method: "QRIS";
  internalStatus: string;
  providerStatus: string;
  amountMinor: string;
  currency: string;
  reconciliation: string;
  lastProviderCheck: string;
}>;

export type AdminFailedJobRowDto = Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
  jobType: string;
  queue: string;
  failureReason: string;
  attempts: number;
  firstFailedAt: string;
  lastFailedAt: string;
  retryState: string;
  relatedResource: string;
}>;

export type AdminPublicationFailureRowDto = Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
  invitationReference: string;
  attemptedVersion: number;
  currentPublishedVersion: number | null;
  failureStage: string;
  failedAt: string;
  previousSnapshotActive: boolean;
  retryState: string;
}>;

export type AdminPrintingRowDto = Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
  orderReference: string;
  maskedWorkspace: string;
  vendor: string;
  productionStatus: string;
  shippingStatus: string;
  lastProviderUpdate: string;
  stuckFor: string;
  escalationState: string;
}>;

export type AdminSupportRowDto = Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
  caseId: string;
  category: string;
  maskedWorkspace: string;
  lastResponse: string;
  escalationState: string;
}>;

export type AdminTemplateStatusRowDto = Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
  templateId: string;
  name: string;
  availability: string;
  version: string;
  packageLink: string;
  readiness: string;
  lastChanged: string;
  reason: string;
}>;

export type AdminAuditRowDto = Readonly<{
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  reason: string;
  result: string;
  correlationId: string;
  masked: boolean;
}>;

export type AdminLifecycleExceptionRowDto = Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
  resourceType: string;
  currentState: string;
  expectedState: string;
  impact: string;
  suggestedAction: string;
  lastTransition: string;
}>;

export type AdminLifecycleRowDto = Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
  resourceType: string;
  currentState: string;
  expectedState: string;
  impact: string;
  suggestedAction: string;
  lastTransition: string;
}>;

// ---------------------------------------------------------------------------
// Scope and repository
// ---------------------------------------------------------------------------

/**
 * Tenant-bound sections read exactly one tenant. Platform-wide sections take
 * `tenantId: null`, which is an explicitly audited cross-tenant read that this
 * repository does not authorize — the caller must have already proven
 * platform-admin privilege.
 */
export type AdminOperationsScope = Readonly<{
  tenantId: string | null;
  limit: number;
  now: Date;
}>;

export interface AdminOperationsRepository {
  loadPayments(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminPaymentRowDto[]>;
  loadFailedJobs(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminFailedJobRowDto[]>;
  loadPublicationFailures(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminPublicationFailureRowDto[]>;
  loadPrinting(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminPrintingRowDto[]>;
  loadSupport(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminSupportRowDto[]>;
  loadTemplates(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminTemplateStatusRowDto[]>;
  loadAudit(scope: AdminOperationsScope): Promise<readonly AdminAuditRowDto[]>;
  loadLifecycle(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminLifecycleExceptionRowDto[]>;
}

/**
 * Tenant predicate. A `null` tenant means platform-wide, which is spelled out
 * as an empty filter rather than silently dropping the check.
 */
function tenantFilter(
  tenantId: string | null,
): Readonly<{ tenantId?: string }> {
  return tenantId === null ? {} : { tenantId };
}

/**
 * Bounds the limit so a caller cannot ask for the whole table. The admin console
 * shows an operational slice, not an export.
 */
function boundedLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit <= 0) return 50;
  return Math.min(limit, 200);
}

function baseRow(
  input: Readonly<{
    id: string;
    reference: string;
    severity: AdminSeverity;
    status: string;
    owner: string;
    at: Date;
    now: Date;
  }>,
): Readonly<{
  id: string;
  reference: string;
  severity: AdminSeverity;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
}> {
  return {
    id: input.id,
    reference: input.reference,
    severity: input.severity,
    status: input.status,
    owner: input.owner,
    age: formatAge(input.at, input.now),
    updatedAt: isoString(input.at),
  };
}

function severityForNotificationStatus(status: string): AdminSeverity {
  if (status === "FAILED") return "critical";
  if (status === "QUEUED") return "warning";
  return "healthy";
}

export class PrismaAdminOperationsRepository implements AdminOperationsRepository {
  public constructor(
    private readonly client: AdminOperationsClient = adaptAdminOperationsClient(
      prisma,
    ),
  ) {}

  public async loadPayments(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminPaymentRowDto[]> {
    const rows = await this.client.payment.findMany({
      where: { ...tenantFilter(scope.tenantId) },
      orderBy: { updatedAt: "desc" },
      take: boundedLimit(scope.limit),
      select: paymentRowSelect,
    });

    return rows.map((row) => ({
      ...baseRow({
        id: row.id,
        reference: row.providerTransactionId,
        severity: severityForPayment({
          paymentStatus: row.status,
          orderStatus: row.order.status,
        }),
        status: row.status,
        // The order owner is an internal user id, so it is masked rather than
        // reported as a name this layer does not have.
        owner: maskIdentifier(row.order.userId),
        at: row.updatedAt,
        now: scope.now,
      }),
      orderReference: row.order.orderNumber,
      paymentReference: row.providerTransactionId,
      // `Payment` has no customer column; the tenant is the closest owning
      // workspace and is masked so the row stays correlatable, not identifying.
      maskedCustomer: maskIdentifier(row.tenantId),
      provider: row.provider,
      method: "QRIS",
      internalStatus: row.status,
      // The provider's own status is only ever recorded through a verified
      // notification, so the internal status is the honest value to show until
      // one arrives.
      providerStatus: row.paidAt === null ? "menunggu" : "berhasil",
      amountMinor: decimalString(row.amountMinor),
      currency: row.currency,
      reconciliation: reconciliationState({
        paymentStatus: row.status,
        paidAt: row.paidAt,
      }),
      lastProviderCheck: isoString(row.updatedAt),
    }));
  }

  public async loadFailedJobs(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminFailedJobRowDto[]> {
    const notificationWhere: Prisma.NotificationWhereInput = {
      ...tenantFilter(scope.tenantId),
      status: { in: ["FAILED", "QUEUED"] },
    };
    const outboxWhere: Prisma.OutboxEventWhereInput = {
      ...tenantFilter(scope.tenantId),
      status: { in: ["FAILED", "PENDING"] },
    };
    const limit = boundedLimit(scope.limit);

    const [notifications, outbox] = await Promise.all([
      this.client.notification.findMany({
        where: notificationWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: notificationRowSelect,
      }),
      this.client.outboxEvent.findMany({
        where: outboxWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: outboxRowSelect,
      }),
    ]);

    const notificationRows = notifications.map((row) => ({
      ...baseRow({
        id: row.id,
        reference: row.id,
        severity: severityForNotificationStatus(row.status),
        status: row.status,
        owner: maskIdentifier(row.tenantId),
        at: row.updatedAt,
        now: scope.now,
      }),
      jobType: row.templateCode,
      queue: queueFor("notification"),
      failureReason: row.lastError ?? "tidak ada kesalahan tercatat",
      attempts: row.attemptCount,
      firstFailedAt: isoString(row.createdAt),
      lastFailedAt: isoString(row.updatedAt),
      retryState: retryStateFor(row.attemptCount),
      // The encrypted recipient is never decrypted; the channel is shown so the
      // operator knows where the message was headed.
      relatedResource: `kanal ${row.channel}`,
    }));

    const outboxRows = outbox.map((row) => ({
      ...baseRow({
        id: row.id,
        reference: row.id,
        severity:
          row.status === "FAILED" ? SEVERITY.critical : SEVERITY.warning,
        status: row.status,
        owner: maskIdentifier(row.tenantId ?? "platform"),
        at: row.lastAttemptAt ?? row.createdAt,
        now: scope.now,
      }),
      jobType: row.eventType,
      queue: queueFor("outbox"),
      failureReason: row.lastError ?? "tidak ada kesalahan tercatat",
      attempts: row.attemptCount,
      firstFailedAt: isoString(row.createdAt),
      lastFailedAt: isoString(row.lastAttemptAt ?? row.createdAt),
      retryState: retryStateFor(row.attemptCount),
      relatedResource: `${row.aggregateType}:${maskIdentifier(row.aggregateId)}`,
    }));

    // Most urgent first. Severity ranking keeps a failed job above a queued one
    // regardless of which model it came from.
    const ranking: Record<AdminSeverity, number> = {
      critical: 0,
      high: 1,
      warning: 2,
      info: 3,
      healthy: 4,
    };
    return [...notificationRows, ...outboxRows]
      .sort((left, right) => ranking[left.severity] - ranking[right.severity])
      .slice(0, limit);
  }

  public async loadPublicationFailures(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminPublicationFailureRowDto[]> {
    const rows = await this.client.invitationPublication.findMany({
      where: {
        ...tenantFilter(scope.tenantId),
        // A failed publication is one that is not active: the transaction that
        // demotes-then-promotes leaves a non-active row behind when the promote
        // step never completes.
        active: false,
      },
      orderBy: { publishedAt: "desc" },
      take: boundedLimit(scope.limit),
      select: publicationFailureSelect,
    });

    return rows.map((row) => ({
      ...baseRow({
        id: row.id,
        reference: row.invitation.slug,
        severity: SEVERITY.high,
        status: row.invitation.status,
        owner: maskIdentifier(row.publishedBy),
        at: row.publishedAt,
        now: scope.now,
      }),
      invitationReference: row.invitation.slug,
      attemptedVersion: row.publicationVersion,
      // The currently active version is not readable from this row alone, and
      // guessing it would misreport which snapshot is live.
      currentPublishedVersion: null,
      // Derived from how far the publication got: a row that exists but is not
      // active stopped between snapshotting and promotion.
      failureStage: "promosi",
      failedAt: isoString(row.publishedAt),
      previousSnapshotActive: false,
      retryState: "dicoba ulang",
    }));
  }

  public async loadPrinting(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminPrintingRowDto[]> {
    const rows = await this.client.printingOrder.findMany({
      where: {
        ...tenantFilter(scope.tenantId),
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { updatedAt: "asc" },
      take: boundedLimit(scope.limit),
      select: printingRowSelect,
    });

    return rows.map((row) => {
      const stuck = isPrintingStuck({
        status: row.status,
        updatedAt: row.updatedAt,
        now: scope.now,
      });

      return {
        ...baseRow({
          id: row.id,
          reference: row.orderId,
          severity: stuck ? SEVERITY.high : SEVERITY.info,
          status: row.status,
          owner: maskIdentifier(row.tenantId),
          at: row.updatedAt,
          now: scope.now,
        }),
        orderReference: row.orderId,
        // The workspace is identified by tenant, which is masked so the console
        // never displays a customer's own name.
        maskedWorkspace: maskIdentifier(row.tenantId),
        vendor: row.vendor.businessName,
        productionStatus: row.status,
        shippingStatus: shippingStatusFor(row.shipments),
        lastProviderUpdate: isoString(row.updatedAt),
        stuckFor: formatDuration(row.updatedAt, scope.now),
        escalationState: escalationStateForStuck(stuck),
      };
    });
  }

  public async loadSupport(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminSupportRowDto[]> {
    const rows = await this.client.supportCase.findMany({
      where: {
        ...tenantFilter(scope.tenantId),
        status: { not: "CLOSED" },
      },
      orderBy: { openedAt: "desc" },
      take: boundedLimit(scope.limit),
      select: supportCaseSelect,
    });

    const severityFromStored = (value: string): AdminSeverity => {
      switch (value) {
        case "critical":
          return SEVERITY.critical;
        case "high":
          return SEVERITY.high;
        case "warning":
          return SEVERITY.warning;
        case "healthy":
          return SEVERITY.healthy;
        default:
          return SEVERITY.info;
      }
    };

    return rows.map((row) => ({
      ...baseRow({
        id: row.id,
        reference: row.reference,
        severity: severityFromStored(row.severity),
        status: row.status,
        owner: row.owner === null ? "belum ditugaskan" : row.owner,
        at: row.updatedAt,
        now: scope.now,
      }),
      caseId: row.reference,
      category: row.category,
      maskedWorkspace: maskIdentifier(row.tenantId),
      // The last response is a timestamp, and the author's name is not stored
      // here — reporting the time keeps the row truthful without inventing a
      // responder.
      lastResponse:
        row.lastResponseAt === null
          ? "belum ada balasan"
          : formatAge(row.lastResponseAt, scope.now),
      escalationState: row.escalationState,
    }));
  }

  public async loadTemplates(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminTemplateStatusRowDto[]> {
    // Platform-wide by design: the template catalog is shared across tenants.
    const rows = await this.client.template.findMany({
      where: {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: boundedLimit(scope.limit),
      select: templateStatusSelect,
    });

    return rows.map((row) => ({
      ...baseRow({
        id: `${row.id}@${row.version}`,
        reference: row.id,
        severity: row.status === "ACTIVE" ? SEVERITY.healthy : SEVERITY.info,
        status: row.status,
        owner: "katalog",
        at: row.createdAt,
        now: scope.now,
      }),
      templateId: row.id,
      name: row.name,
      availability: row.status,
      version: row.version,
      // The template-to-package link lives in the catalog configuration, not in
      // this table, so it is reported as unmapped rather than guessed.
      packageLink: "belum dipetakan",
      readiness: row.licenseStatus,
      lastChanged: isoString(row.createdAt),
      reason: row.licenseStatus === "VERIFIED" ? "siap" : "menunggu verifikasi",
    }));
  }

  public async loadAudit(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminAuditRowDto[]> {
    // Platform-wide by design. Reading audit rows across tenants is the point of
    // the section; the caller has already proven platform-admin privilege.
    const rows = await this.client.auditEvent.findMany({
      where: { ...tenantFilter(scope.tenantId) },
      orderBy: { createdAt: "desc" },
      take: boundedLimit(scope.limit),
      select: auditRowSelect,
    });

    return rows.map((row) => ({
      id: row.id,
      timestamp: isoString(row.createdAt),
      // An actor is either a person or a system component. For a person the id
      // is masked; the display name is deliberately not joined in here.
      actor: maskIdentifier(row.userId ?? row.actorType),
      role: row.actorType,
      action: row.action,
      target: `${row.targetType}:${maskIdentifier(row.targetId)}`,
      reason: row.reason ?? "tidak dicatat",
      result: "tercatat",
      correlationId: row.correlationId,
      masked: true,
    }));
  }

  public async loadLifecycle(
    scope: AdminOperationsScope,
  ): Promise<readonly AdminLifecycleExceptionRowDto[]> {
    const rows = await this.client.invitation.findMany({
      where: {
        ...tenantFilter(scope.tenantId),
        // An invitation that is READY but never published is the lifecycle
        // exception an operator can act on: the draft is complete and the
        // customer is waiting.
        status: "READY",
      },
      orderBy: { updatedAt: "asc" },
      take: boundedLimit(scope.limit),
      select: invitationLifecycleSelect,
    });

    return rows.map((row) => ({
      ...baseRow({
        id: row.id,
        reference: row.slug,
        severity: SEVERITY.warning,
        status: row.status,
        owner: maskIdentifier(row.tenantId),
        at: row.updatedAt,
        now: scope.now,
      }),
      resourceType: "undangan",
      currentState: row.status,
      expectedState: "PUBLISHED",
      impact: "undangan belum dapat diakses tamu",
      suggestedAction: "minta pemilik menerbitkan undangan",
      lastTransition: isoString(row.updatedAt),
    }));
  }
}
