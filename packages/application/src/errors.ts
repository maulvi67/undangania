export type ApplicationErrorCode =
  "AUTH_REQUIRED" | "FORBIDDEN" | "TENANT_MISMATCH";

export class ApplicationError extends Error {
  public constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export class AuthRequiredError extends ApplicationError {
  public constructor() {
    super("AUTH_REQUIRED", "Authentication is required.");
    this.name = "AuthRequiredError";
  }
}

export class ForbiddenError extends ApplicationError {
  public constructor() {
    super("FORBIDDEN", "You do not have permission to perform this action.");
    this.name = "ForbiddenError";
  }
}

export class TenantMismatchError extends ApplicationError {
  public constructor() {
    super("TENANT_MISMATCH", "The requested tenant is not available.");
    this.name = "TenantMismatchError";
  }
}
