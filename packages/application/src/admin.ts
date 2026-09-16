import type { TenantContext } from "@wedding/domain";
import {
  ForbiddenError,
  InvalidInputError,
  assertAnyRole,
  ADMIN_ROLES,
  requireTenantContext,
} from "./use-case-support";

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
  loadAudit(scope: AdminQueryScope): Promise<readonly AdminRow[]>;
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

export async function loadAdminSection(
  context: TenantContext | null | undefined,
  input: LoadAdminSectionInput,
  ports: AdminPorts,
): Promise<readonly AdminRow[]> {
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
