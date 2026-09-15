import {
  filterGuestHouseholds,
  guestListItemSchema,
  parseGuestQuery,
  type GuestDetailLoadResult,
  type GuestFixture,
  type GuestHouseholdDetail,
  type GuestListQuery,
  type GuestLoadResult,
  type GuestManagementData,
  type GuestRole,
} from "./contract";
import { getGuestHouseholdDetail, getGuestManagementData } from "./fixtures";

/**
 * DEVELOPMENT FIXTURE ONLY.
 *
 * This transport does not authenticate, authorize, persist, or query tenant
 * data. Replace it with a server-side application transport before exposing
 * real guest information. Its DTO shape intentionally mirrors the planned
 * tenant-scoped API boundary.
 */
export async function loadGuests(
  fixture: GuestFixture = "normal",
  query?: Partial<Omit<GuestListQuery, "fixture">>,
  role: GuestRole = "OWNER",
): Promise<GuestLoadResult> {
  const management = getGuestManagementData(fixture, role);
  if (fixture === "permission-denied") return { kind: "forbidden" };
  if (fixture === "unavailable") return { kind: "unavailable" };
  const parsedQuery = parseGuestQuery({ fixture, ...query });
  const households = filterGuestHouseholds(
    management.households,
    parsedQuery,
  ).map((item) => guestListItemSchema.parse(item));
  return { kind: "ok", data: { ...management, households } };
}

export async function loadGuestHousehold(
  householdId: string,
  fixture: GuestFixture = "normal",
  role: GuestRole = "OWNER",
): Promise<GuestDetailLoadResult> {
  if (fixture === "permission-denied") return { kind: "forbidden" };
  if (fixture === "unavailable") return { kind: "unavailable" };
  const management = getGuestManagementData(fixture, role);
  const household = getGuestHouseholdDetail(householdId, fixture, role);
  if (!household) return { kind: "not-found" };
  return { kind: "ok", data: { household, management } };
}

export function getGuestDetailForDevelopment(
  householdId: string,
  fixture: GuestFixture = "normal",
): GuestHouseholdDetail | undefined {
  return getGuestHouseholdDetail(householdId, fixture);
}

export function guestLoadResultKind(
  result: GuestLoadResult,
): GuestLoadResult["kind"] {
  return result.kind;
}

export type GuestListTransport = {
  load: typeof loadGuests;
};

export function tenantScopedGuestResourceKey(
  tenantId: string,
  weddingId: string,
  householdId?: string,
): string {
  // This helper documents the cache/resource key that the live transport must
  // use. Fixture UI never receives these identifiers.
  return ["guest", tenantId, weddingId, householdId].filter(Boolean).join(":");
}

export function assertHouseholdBelongsToWorkspace(
  householdId: string,
  allowedHouseholdIds: readonly string[],
): void {
  if (!allowedHouseholdIds.includes(householdId)) {
    throw new Error("HOUSEHOLD_NOT_IN_WORKSPACE");
  }
}

export function managementDataForResult(
  result: GuestLoadResult,
): GuestManagementData | null {
  if (result.kind !== "ok") return null;
  return result.data;
}
