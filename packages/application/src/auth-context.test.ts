import { describe, expect, it } from "vitest";
import {
  AuthRequiredError,
  ForbiddenError,
  TenantMismatchError,
  createRequestAuthContext,
  hasAnyRole,
  hasRole,
  requireAnyRole,
  requireAuthenticated,
  requireRole,
  requireTenant,
  toTenantContext,
} from "./index";

const context = createRequestAuthContext({
  actorId: "user-1",
  sessionId: "session-1",
  tenantId: "tenant-1",
  roles: ["OWNER", "EDITOR"],
});

describe("request auth context", () => {
  it("copies role input and exposes the tenant context shape", () => {
    expect(context).toEqual({
      actorId: "user-1",
      sessionId: "session-1",
      tenantId: "tenant-1",
      roles: ["OWNER", "EDITOR"],
    });
    expect(toTenantContext(context, "tenant-1")).toEqual({
      actorId: "user-1",
      tenantId: "tenant-1",
      roles: ["OWNER", "EDITOR"],
    });
  });

  it("requires an authenticated context and matching tenant", () => {
    expect(() => requireAuthenticated(null)).toThrowError(AuthRequiredError);
    expect(() => requireTenant(undefined, "tenant-1")).toThrowError(
      AuthRequiredError,
    );
    expect(() => requireTenant(context, "tenant-2")).toThrowError(
      TenantMismatchError,
    );
    expect(requireTenant(context, "tenant-1")).toEqual(context);
  });

  it("checks individual and alternative roles without treating authentication as authorization", () => {
    expect(hasRole(context, "OWNER")).toBe(true);
    expect(hasRole(context, "FINANCE")).toBe(false);
    expect(hasAnyRole(context, ["FINANCE", "EDITOR"])).toBe(true);
    expect(hasAnyRole(null, ["OWNER"])).toBe(false);
    expect(requireRole(context, "OWNER")).toBe(context);
    expect(requireAnyRole(context, ["FINANCE", "EDITOR"])).toBe(context);
    expect(() => requireRole(context, "FINANCE")).toThrowError(ForbiddenError);
  });
});
