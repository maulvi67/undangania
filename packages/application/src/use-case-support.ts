import type { TenantContext } from "@wedding/domain";
import { AuthRequiredError, ForbiddenError } from "./errors";
import { MEMBER_ROLES, type MemberRole } from "./auth-context";

/**
 * Re-exported so a use-case module needs one import for both the errors it
 * throws and the helpers that raise them. They originate in `./errors`.
 */
export { AuthRequiredError, ForbiddenError };

/**
 * Use-case layer for the four persistence slices delivered alongside this file.
 *
 * Ports are declared *structurally* here and `@wedding/application` deliberately
 * does not import `@wedding/database`. The package depends only on
 * `@wedding/domain`, which keeps the dependency arrow pointing inward: the
 * database package implements these shapes, not the other way round.
 *
 * Every use-case takes a `TenantContext` and re-asserts it before calling a
 * port. That is re-checking what the caller already did, and it is intentional:
 * a use-case that can be invoked without authorization is a use-case that will
 * be, so the tenant and role requirements are part of the operation itself.
 */

// ---------------------------------------------------------------------------
// Shared errors
// ---------------------------------------------------------------------------

export type UseCaseErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "NOT_FOUND"
  | "STALE"
  | "CONFLICT"
  | "INVALID"
  | "UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "ENTITLEMENT_REQUIRED"
  | "ENTITLEMENT_LIMIT_REACHED"
  | "NOT_IMPLEMENTED";

export class UseCaseError extends Error {
  public constructor(
    public readonly code: UseCaseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UseCaseError";
  }
}

export class NotFoundError extends UseCaseError {
  public constructor(message = "The requested resource was not found.") {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class StaleVersionError extends UseCaseError {
  public constructor(message = "The resource was modified by someone else.") {
    super("STALE", message);
    this.name = "StaleVersionError";
  }
}

export class ConflictError extends UseCaseError {
  public constructor(message = "The request conflicts with existing state.") {
    super("CONFLICT", message);
    this.name = "ConflictError";
  }
}

export class InvalidInputError extends UseCaseError {
  public constructor(message = "The request could not be validated.") {
    super("INVALID", message);
    this.name = "InvalidInputError";
  }
}

export class UnavailableError extends UseCaseError {
  public constructor(message = "The service is temporarily unavailable.") {
    super("UNAVAILABLE", message);
    this.name = "UnavailableError";
  }
}

export class ProviderUnavailableError extends UseCaseError {
  public constructor(message = "The upstream provider is unavailable.") {
    super("PROVIDER_UNAVAILABLE", message);
    this.name = "ProviderUnavailableError";
  }
}

export class EntitlementRequiredError extends UseCaseError {
  public constructor(
    message = "An active entitlement is required for this action.",
  ) {
    super("ENTITLEMENT_REQUIRED", message);
    this.name = "EntitlementRequiredError";
  }
}

export class EntitlementLimitReachedError extends UseCaseError {
  public constructor(
    message = "The current package does not allow this action.",
  ) {
    super("ENTITLEMENT_LIMIT_REACHED", message);
    this.name = "EntitlementLimitReachedError";
  }
}

/**
 * Raised where a use-case is intentionally wired but the underlying capability
 * is not enabled yet. Refusing explicitly beats returning a plausible empty
 * result, which is how a missing integration turns into silent data loss.
 */
export class NotImplementedError extends UseCaseError {
  public constructor(message = "This operation is not enabled yet.") {
    super("NOT_IMPLEMENTED", message);
    this.name = "NotImplementedError";
  }
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

/**
 * Asserts the context carries a tenant. `TenantContext` requires one, so this
 * guards against a caller that built the object by hand from request data.
 */
export function requireTenantContext(
  context: TenantContext | null | undefined,
): TenantContext {
  if (context === null || context === undefined) {
    throw new AuthRequiredError();
  }
  if (context.tenantId.trim().length === 0) {
    throw new AuthRequiredError();
  }
  if (context.actorId.trim().length === 0) {
    throw new AuthRequiredError();
  }
  return context;
}

export function assertAnyRole(
  context: TenantContext,
  roles: readonly MemberRole[],
): void {
  // `TenantContext.roles` is `readonly string[]`, so a context built by hand
  // from request data could carry a role string that is not a known member
  // role. Narrowing against `MEMBER_ROLES` first means an unknown role string
  // can never accidentally satisfy a requirement.
  const granted = context.roles.filter((role): role is MemberRole =>
    (MEMBER_ROLES as readonly string[]).includes(role),
  );
  if (!roles.some((role) => granted.includes(role))) {
    throw new ForbiddenError();
  }
}

/** Roles that may change invitation content. */
export const EDITOR_ROLES = [
  "OWNER",
  "EDITOR",
] as const satisfies readonly MemberRole[];

/** Roles that may complete onboarding. */
export const OWNER_ROLES = ["OWNER"] as const satisfies readonly MemberRole[];

/** Roles that may read the admin console. */
export const ADMIN_ROLES = ["ADMIN"] as const satisfies readonly MemberRole[];

/** Roles that may read and manage checkout for their own tenant. */
export const FINANCE_ROLES = [
  "OWNER",
  "FINANCE",
] as const satisfies readonly MemberRole[];

// ---------------------------------------------------------------------------
// Shared value guards
// ---------------------------------------------------------------------------

/**
 * ISO-8601 calendar date. Dates are passed as strings across this boundary so a
 * timezone cannot be introduced by a `Date` object round trip.
 */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isNonEmptyText(value: string, maxLength: number): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}
