import type { GuestHouseholdDetail, GuestHouseholdListItem } from "./contract";

/**
 * Build a safe diagnostic shape for fixture or UI error reporting. Guest
 * contacts, token material, and personalized URLs never cross this boundary.
 */
export function scrubGuestForDiagnostics(
  household: GuestHouseholdListItem | GuestHouseholdDetail,
): Readonly<{
  householdId: string;
  memberCount: number;
  linkStatus: GuestHouseholdListItem["linkStatus"];
}> {
  return {
    householdId: household.id,
    memberCount: household.memberCount,
    linkStatus: household.linkStatus,
  };
}
