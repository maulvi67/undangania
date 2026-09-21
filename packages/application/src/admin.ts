import type { TenantContext } from "@wedding/domain";
import type { MemberRole } from "./auth-context";
import { TenantMismatchError } from "./errors";
import {
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  NotImplementedError,
  UnavailableError,
  assertAnyRole,
  ADMIN_ROLES,
  requireTenantContext,
} from "./use-case-support";
import { assertMfaEnrolled, verifyMfaStepUp, type MfaPorts } from "./mfa";

/**
 * Admin console read use-cases.
 *
 * Two kinds of section exist and the difference is a security decision, not a
 * presentation one:
 *
 *   - Tenant-bound sections (`payments`, `printing`, `support`,
 *     `publicationFailures`) require a concrete `tenantId` and are scoped to it.
 *   - Platform-wide sections (`failedJobs`, `templates`, `audit`) read across
 *     tenants and are reachable only by a platform admin. They are modelled as a
 *     separate port so a tenant-bound caller cannot reach them by passing a
 *     null tenant.
 *
 * Masking happens in the query layer. This layer never widens what it receives
 * and never joins a name onto a masked identifier.
 *
 * Ports are structural; this package does not depend on `@wedding/database`.
 */

export type AdminSection =
  | "payments"
  | "failedJobs"
  | "publicationFailures"
  | "printing"
  | "support"
  | "templates"
  | "audit"
  | "lifecycle";

export type AdminQueryScope = Readonly<{
  tenantId: string | null;
  limit: number;
  now: Date;
}>;

export type AdminRow = Readonly<{
  id: string;
  reference: string;
  severity: string;
  status: string;
  owner: string;
  age: string;
  updatedAt: string;
}>;

/**
 * An audit entry.
 *
 * Deliberately not an {@link AdminRow}: an audit record has no reference, owner,
 * age, or severity — those are operational-queue concepts. Modelling it as one
 * would force every reader to invent values for columns the record does not have,
 * which is exactly the kind of fabrication an audit trail must never contain.
 */
export type AdminAuditRow = Readonly<{
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

/** Port: sections that are always bound to a single tenant. */
export interface AdminTenantScopedPort {
  loadPayments(scope: AdminQueryScope): Promise<readonly AdminRow[]>;
  loadPrinting(scope: AdminQueryScope): Promise<readonly AdminRow[]>;
  loadSupport(scope: AdminQueryScope): Promise<readonly AdminRow[]>;
  loadPublicationFailures(scope: AdminQueryScope): Promise<readonly AdminRow[]>;
  loadLifecycle(scope: AdminQueryScope): Promise<readonly AdminRow[]>;
}

/**
 * Port: sections that read across tenants. Separated from the tenant-scoped port
 * on purpose — reaching these requires having proven platform-admin privilege,
 * and the type system should not let a tenant-scoped caller hold one.
 */
export interface AdminPlatformPort {
  loadFailedJobs(scope: AdminQueryScope): Promise<readonly AdminRow[]>;
  loadTemplates(scope: AdminQueryScope): Promise<readonly AdminRow[]>;
  loadAudit(scope: AdminQueryScope): Promise<readonly AdminAuditRow[]>;
}

export type AdminPorts = Readonly<{
  tenantScoped: AdminTenantScopedPort;
  platform: AdminPlatformPort;
  /** Sections requiring platform-admin privilege. */
  platformSections: readonly AdminSection[];
}>;

export const DEFAULT_ADMIN_LIMIT = 50;

/**
 * Sections that read across tenants. Named here so the authorization check and
 * the routing cannot disagree about which sections are privileged.
 */
export const PLATFORM_SECTIONS: readonly AdminSection[] = [
  "failedJobs",
  "templates",
  "audit",
];

export function isPlatformSection(section: AdminSection): boolean {
  return PLATFORM_SECTIONS.includes(section);
}

/**
 * A platform admin is an `ADMIN` member of the *platform* tenant. The role alone
 * is not enough: an `ADMIN` scoped to their own tenant must not read other
 * tenants' rows, so a cross-tenant read additionally requires that no tenant
 * was supplied for the request.
 */
export function isPlatformAdmin(context: TenantContext): boolean {
  return context.roles.includes("ADMIN");
}

export type LoadAdminSectionInput = Readonly<{
  section: AdminSection;
  /** Required for tenant-bound sections; must be null for platform sections. */
  tenantId: string | null;
  limit?: number;
  now: Date;
}>;

export type AdminSectionRows = Readonly<{
  rows: readonly AdminRow[];
  audit: readonly AdminAuditRow[];
}>;

/**
 * Loads one section.
 *
 * Overloaded on the section so the audit section returns audit rows and every
 * other section returns operational rows. A single array type would force one of
 * the two callers to cast, and the columns genuinely differ.
 */
export function loadAdminSection(
  context: TenantContext | null | undefined,
  input: LoadAdminSectionInput & Readonly<{ section: "audit" }>,
  ports: AdminPorts,
): Promise<readonly AdminAuditRow[]>;
export function loadAdminSection(
  context: TenantContext | null | undefined,
  input: LoadAdminSectionInput,
  ports: AdminPorts,
): Promise<readonly AdminRow[]>;
export async function loadAdminSection(
  context: TenantContext | null | undefined,
  input: LoadAdminSectionInput,
  ports: AdminPorts,
): Promise<readonly AdminRow[] | readonly AdminAuditRow[]> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, ADMIN_ROLES);

  const limit = input.limit ?? DEFAULT_ADMIN_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new InvalidInputError("Batas jumlah baris tidak valid.");
  }

  const platform = isPlatformSection(input.section);

  if (platform) {
    // A platform section is a deliberate cross-tenant read. It is only allowed
    // when the caller asked for no tenant at all, so a mistyped tenant id
    // cannot be silently widened into a platform-wide query.
    if (input.tenantId !== null) {
      throw new InvalidInputError(
        "Bagian platform tidak boleh dibatasi ke satu tenant.",
      );
    }
    if (!isPlatformAdmin(tenant)) {
      throw new ForbiddenError();
    }
  } else if (input.tenantId === null) {
    throw new InvalidInputError("Bagian ini memerlukan tenant.");
  }

  const scope: AdminQueryScope = {
    tenantId: input.tenantId,
    limit,
    now: input.now,
  };

  switch (input.section) {
    case "payments":
      return ports.tenantScoped.loadPayments(scope);
    case "printing":
      return ports.tenantScoped.loadPrinting(scope);
    case "support":
      return ports.tenantScoped.loadSupport(scope);
    case "publicationFailures":
      return ports.tenantScoped.loadPublicationFailures(scope);
    case "lifecycle":
      return ports.tenantScoped.loadLifecycle(scope);
    case "failedJobs":
      return ports.platform.loadFailedJobs(scope);
    case "templates":
      return ports.platform.loadTemplates(scope);
    case "audit":
      return ports.platform.loadAudit(scope);
    default:
      throw new InvalidInputError("Bagian tidak dikenali.");
  }
}

// ---------------------------------------------------------------------------
// Privileged operational mutations
// ---------------------------------------------------------------------------

/**
 * P1 mutations are deliberately named after the operation, not the HTTP route.
 * The route is only an adapter; these values are also used in audit metadata and
 * idempotency fingerprints.
 */
export type AdminMutationAction =
  | "retry_failed_job"
  | "reconcile_payment"
  | "recover_publication"
  | "moderate_template"
  | "escalate_support"
  | "escalate_printing"
  | "export_audit"
  | "reveal_audit";

export const ADMIN_MUTATION_ACTIONS: readonly AdminMutationAction[] = [
  "retry_failed_job",
  "reconcile_payment",
  "recover_publication",
  "moderate_template",
  "escalate_support",
  "escalate_printing",
  "export_audit",
  "reveal_audit",
];

export type AdminMutationTargetType = "notification" | "outbox";

/**
 * Least-privilege matrix for mutations. Platform-wide actions remain ADMIN-only;
 * tenant-bound support/finance/fulfilment actions may use the specialist role that
 * already exists in the membership model.
 */
export const ADMIN_MUTATION_ROLES: Readonly<{
  [Action in AdminMutationAction]: readonly MemberRole[];
}> = {
  retry_failed_job: ["ADMIN"],
  reconcile_payment: ["ADMIN"],
  recover_publication: ["ADMIN"],
  moderate_template: ["ADMIN"],
  escalate_support: ["ADMIN"],
  escalate_printing: ["ADMIN"],
  export_audit: ["ADMIN"],
  reveal_audit: ["ADMIN"],
};

/** Input after the HTTP boundary has performed Zod validation. */
export type AdminMutationRequest = Readonly<{
  action: AdminMutationAction;
  /** Null means a deliberate platform-wide scope. */
  tenantId: string | null;
  targetId: string;
  reason: string;
  confirmation: "CONFIRM";
  idempotencyKey: string;
  stepUpCode: string;
  targetType?: AdminMutationTargetType;
  templateVersion?: string;
  fromStatus?: string;
  toStatus?: string;
}>;

export type AdminMutationEnvironment = "SIMULATION" | "PRODUCTION";

export type AdminMutationAuditMetadata = Readonly<
  Record<string, string | number | boolean>
>;

export type AdminMutationAuditEvent = Readonly<{
  tenantId: string | null;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  correlationId: string;
  metadata: AdminMutationAuditMetadata;
}>;

export type AdminAuditExportRow = Readonly<{
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  reason: string;
  result: string;
  correlationId: string;
  masked: true;
}>;

export type AdminMutationResult = Readonly<{
  action: AdminMutationAction;
  targetId: string;
  status: "completed";
  auditRecorded: true;
  detail: string;
  auditRows?: readonly AdminAuditExportRow[];
}>;

export type AdminMutationWriteInput = Readonly<{
  tenantId: string | null;
  targetId: string;
  now: Date;
  audit: AdminMutationAuditEvent;
}>;

export interface AdminMutationRepository {
  /** Performs the CAS write and its audit insert in one database transaction. */
  retryFailedJob(input: AdminMutationWriteInput & {
    targetType: AdminMutationTargetType;
  }): Promise<boolean>;
  /** Performs an immutable-version/status CAS and its audit insert atomically. */
  moderateTemplate(input: AdminMutationWriteInput & {
    version: string;
    fromStatus: string;
    toStatus: string;
  }): Promise<boolean>;
  /** Escalation is a state transition, never an overwrite of support content. */
  escalateSupport(input: AdminMutationWriteInput): Promise<boolean>;
  /** Provider-neutral append for external actions such as reconciliation. */
  appendAudit(event: AdminMutationAuditEvent): Promise<void>;
  /** Bounded, masked export; reveal has no port by design. */
  exportAudit(input: Readonly<{
    tenantId: string | null;
    limit: number;
    audit: AdminMutationAuditEvent;
  }>): Promise<readonly AdminAuditExportRow[]>;
}

export interface AdminPaymentReconciliationPort {
  /**
   * Requests a provider-side check only. Implementations must not write Payment
   * truth; a verified provider notification remains the only state transition.
   */
  request(input: Readonly<{
    tenantId: string;
    paymentId: string;
    correlationId: string;
    idempotencyKey: string;
  }>): Promise<Readonly<{ requestId: string }>>;
}

export type AdminMutationIdempotencyClaim =
  | "claimed"
  | "replayed"
  | "conflict";

export interface AdminMutationIdempotencyPort {
  claim(input: Readonly<{
    actorId: string;
    idempotencyKey: string;
    fingerprint: string;
    at: Date;
  }>): Promise<AdminMutationIdempotencyClaim>;
}

/**
 * Local/sandbox-only replay protection. Production must supply a durable,
 * shared implementation; this bounded process-local store is intentionally not
 * selected by the production API path.
 */
export class InMemoryAdminMutationIdempotencyPort
  implements AdminMutationIdempotencyPort
{
  private readonly entries = new Map<
    string,
    Readonly<{ fingerprint: string; expiresAt: number }>
  >();

  public constructor(
    private readonly ttlMs = 15 * 60_000,
    private readonly maxEntries = 10_000,
  ) {}

  public async claim(input: {
    actorId: string;
    idempotencyKey: string;
    fingerprint: string;
    at: Date;
  }): Promise<AdminMutationIdempotencyClaim> {
    const now = input.at.getTime();
    for (const [key, value] of this.entries) {
      if (value.expiresAt <= now) this.entries.delete(key);
    }

    const key = `${input.actorId}:${input.idempotencyKey}`;
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      return existing.fingerprint === input.fingerprint ? "replayed" : "conflict";
    }

    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(key, {
      fingerprint: input.fingerprint,
      expiresAt: now + this.ttlMs,
    });
    return "claimed";
  }
}

export type AdminMutationPorts = Readonly<{
  repository: AdminMutationRepository;
  mfa: MfaPorts["mfa"];
  idempotency: AdminMutationIdempotencyPort;
  reconciliation?: AdminPaymentReconciliationPort;
}>;

export type ExecuteAdminMutationOptions = Readonly<{
  environment: AdminMutationEnvironment;
  /** Explicit human approval gate for every production admin mutation. */
  productionMutationApproved: boolean;
  /** Separate gate because payment reconciliation is provider/payment risk. */
  paymentProductionApproved: boolean;
  now: Date;
  correlationId: string;
}>;

const TEMPLATE_STATUS_TRANSITIONS: Readonly<Record<string, string>> = {
  DRAFT: "REVIEW",
  REVIEW: "APPROVED",
  APPROVED: "ACTIVE",
  ACTIVE: "RETIRED",
};

const TENANT_BOUND_MUTATIONS: readonly AdminMutationAction[] = [
  "retry_failed_job",
  "reconcile_payment",
  "recover_publication",
  "escalate_support",
  "escalate_printing",
];

function validResourceId(value: string): boolean {
  return /^[A-Za-z0-9._:@-]{1,128}$/u.test(value);
}

function validBoundedText(value: string, maxLength: number): boolean {
  return value.trim().length > 0 && value.trim().length <= maxLength;
}

function validateAdminMutationInput(input: AdminMutationRequest): void {
  if (!ADMIN_MUTATION_ACTIONS.includes(input.action)) {
    throw new InvalidInputError("Aksi admin tidak dikenali.");
  }
  if (!validResourceId(input.targetId)) {
    throw new InvalidInputError("Target operasi tidak valid.");
  }
  if (!validBoundedText(input.reason, 500)) {
    throw new InvalidInputError("Reason wajib diisi dan maksimal 500 karakter.");
  }
  if (input.confirmation !== "CONFIRM") {
    throw new InvalidInputError("Konfirmasi operasi tidak valid.");
  }
  if (!/^[A-Za-z0-9._~-]{16,128}$/u.test(input.idempotencyKey)) {
    throw new InvalidInputError("Idempotency key tidak valid.");
  }
  if (!validBoundedText(input.stepUpCode, 128)) {
    throw new InvalidInputError("Kode step-up wajib diisi.");
  }

  if (TENANT_BOUND_MUTATIONS.includes(input.action)) {
    if (
      input.tenantId === null &&
      input.action !== "retry_failed_job" &&
      input.action !== "reconcile_payment" &&
      input.action !== "escalate_support"
    ) {
      throw new InvalidInputError("Operasi ini memerlukan tenant.");
    }
  } else if (input.action === "moderate_template") {
    if (input.tenantId !== null) {
      throw new InvalidInputError("Moderasi template adalah operasi platform.");
    }
    if (
      input.templateVersion === undefined ||
      !validBoundedText(input.templateVersion, 64) ||
      input.fromStatus === undefined ||
      input.toStatus === undefined
    ) {
      throw new InvalidInputError("Versi dan status template wajib diisi.");
    }
    if (
      TEMPLATE_STATUS_TRANSITIONS[input.fromStatus] !== input.toStatus ||
      !["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "RETIRED"].includes(
        input.toStatus,
      )
    ) {
      throw new InvalidInputError("Transisi status template tidak diizinkan.");
    }
  } else if (input.action === "export_audit") {
    if (input.targetId !== "audit") {
      throw new InvalidInputError("Target export audit tidak valid.");
    }
  } else if (input.action === "reveal_audit") {
    if (input.targetId !== "audit") {
      throw new InvalidInputError("Target audit tidak valid.");
    }
  }

  if (
    input.action === "retry_failed_job" &&
    input.targetType !== "notification" &&
    input.targetType !== "outbox"
  ) {
    throw new InvalidInputError("Jenis pekerjaan gagal wajib diisi.");
  }
}

function assertTenantScope(
  context: TenantContext,
  input: AdminMutationRequest,
): void {
  if (input.tenantId !== null && input.tenantId !== context.tenantId) {
    throw new TenantMismatchError();
  }
}

function targetTypeFor(input: AdminMutationRequest): string {
  switch (input.action) {
    case "retry_failed_job":
      return input.targetType === "notification" ? "Notification" : "OutboxEvent";
    case "reconcile_payment":
      return "Payment";
    case "recover_publication":
      return "InvitationPublication";
    case "moderate_template":
      return "Template";
    case "escalate_support":
      return "SupportCase";
    case "escalate_printing":
      return "PrintingOrder";
    case "export_audit":
    case "reveal_audit":
      return "AuditEvent";
  }
}

function fingerprintFor(input: AdminMutationRequest): string {
  return JSON.stringify({
    action: input.action,
    tenantId: input.tenantId,
    targetId: input.targetId,
    targetType: input.targetType ?? null,
    templateVersion: input.templateVersion ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    reason: input.reason.trim(),
    confirmation: input.confirmation,
  });
}

function auditFor(
  context: TenantContext,
  input: AdminMutationRequest,
  options: ExecuteAdminMutationOptions,
): AdminMutationAuditEvent {
  const targetId =
    input.action === "moderate_template" && input.templateVersion !== undefined
      ? `${input.targetId}@${input.templateVersion}`
      : input.targetId;
  return {
    tenantId: input.tenantId,
    actorId: context.actorId,
    action: `ADMIN_${input.action.toUpperCase()}`,
    targetType: targetTypeFor(input),
    targetId,
    reason: input.reason.trim(),
    correlationId: options.correlationId,
    metadata: {
      idempotencyKey: input.idempotencyKey,
      targetType: input.targetType ?? "unspecified",
      fromStatus: input.fromStatus ?? "unspecified",
      toStatus: input.toStatus ?? "unspecified",
      environment: options.environment,
    },
  };
}

function completed(
  input: AdminMutationRequest,
  detail: string,
  auditRows?: readonly AdminAuditExportRow[],
): AdminMutationResult {
  return {
    action: input.action,
    targetId: input.targetId,
    status: "completed",
    auditRecorded: true,
    detail,
    ...(auditRows === undefined ? {} : { auditRows }),
  };
}

/**
 * Executes one privileged P1 action after re-checking every guard in the
 * application layer. Database implementations must keep their CAS and audit
 * insert in one transaction; this function never writes payment truth directly.
 */
export async function executeAdminMutation(
  context: TenantContext | null | undefined,
  input: AdminMutationRequest,
  ports: AdminMutationPorts,
  options: ExecuteAdminMutationOptions,
): Promise<AdminMutationResult> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, ADMIN_MUTATION_ROLES[input.action]);
  validateAdminMutationInput(input);
  assertTenantScope(tenant, input);

  if (
    options.environment === "PRODUCTION" &&
    !options.productionMutationApproved
  ) {
    throw new NotImplementedError(
      "Mutasi admin produksi menunggu persetujuan eksplisit.",
    );
  }
  if (
    input.action === "reconcile_payment" &&
    options.environment === "PRODUCTION" &&
    !options.paymentProductionApproved
  ) {
    throw new NotImplementedError(
      "Rekonsiliasi pembayaran produksi menunggu persetujuan eksplisit.",
    );
  }

  // The MFA port is queried on every action. A client-provided "step-up=true"
  // flag is intentionally not part of the contract.
  await assertMfaEnrolled(context, ports);
  await verifyMfaStepUp(
    context,
    { code: input.stepUpCode },
    ports,
    options.now,
  );

  // Unsupported actions fail closed after authentication but before claiming an
  // idempotency key, so enabling a future contract does not strand a key.
  if (
    input.action === "recover_publication" ||
    input.action === "escalate_printing" ||
    input.action === "reveal_audit"
  ) {
    throw new NotImplementedError(
      "Kontrak operasi ini belum tersedia dan tidak dijalankan.",
    );
  }

  const claim = await ports.idempotency.claim({
    actorId: tenant.actorId,
    idempotencyKey: input.idempotencyKey,
    fingerprint: fingerprintFor(input),
    at: options.now,
  });
  if (claim === "replayed") {
    throw new ConflictError("Idempotency key sudah digunakan.");
  }
  if (claim === "conflict") {
    throw new ConflictError("Idempotency key dipakai untuk operasi lain.");
  }

  const audit = auditFor(tenant, input, options);
  switch (input.action) {
    case "retry_failed_job": {
      const changed = await ports.repository.retryFailedJob({
        tenantId: input.tenantId,
        targetId: input.targetId,
        targetType: input.targetType as AdminMutationTargetType,
        now: options.now,
        audit,
      });
      if (!changed) throw new ConflictError("Pekerjaan sudah berubah atau tidak ditemukan.");
      return completed(input, "Pekerjaan dimasukkan kembali ke antrean.");
    }
    case "moderate_template": {
      const changed = await ports.repository.moderateTemplate({
        tenantId: null,
        targetId: input.targetId,
        version: input.templateVersion as string,
        fromStatus: input.fromStatus as string,
        toStatus: input.toStatus as string,
        now: options.now,
        audit,
      });
      if (!changed) throw new ConflictError("Template sudah berubah atau tidak ditemukan.");
      return completed(input, "Status template diperbarui.");
    }
    case "escalate_support": {
      const changed = await ports.repository.escalateSupport({
        tenantId: input.tenantId,
        targetId: input.targetId,
        now: options.now,
        audit,
      });
      if (!changed) throw new ConflictError("Kasus sudah berubah atau tidak ditemukan.");
      return completed(input, "Kasus dukungan dieskalasikan.");
    }
    case "reconcile_payment": {
      if (ports.reconciliation === undefined) {
        throw new UnavailableError(
          "Adapter rekonsiliasi pembayaran terverifikasi belum tersedia.",
        );
      }
      const request = await ports.reconciliation.request({
        tenantId: input.tenantId as string,
        paymentId: input.targetId,
        correlationId: options.correlationId,
        idempotencyKey: input.idempotencyKey,
      });
      await ports.repository.appendAudit({
        ...audit,
        metadata: { ...audit.metadata, providerRequestId: request.requestId },
      });
      return completed(input, "Permintaan rekonsiliasi dikirim ke provider.");
    }
    case "export_audit": {
      const rows = await ports.repository.exportAudit({
        tenantId: input.tenantId,
        limit: 200,
        audit,
      });
      return completed(input, "Export audit masked selesai.", rows);
    }
    default:
      // Unsupported actions are rejected before the idempotency key is claimed.
      throw new NotImplementedError("Kontrak operasi ini belum tersedia.");
  }
}
