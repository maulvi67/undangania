import type { GuestCapabilitySet, GuestRole } from "./contract";

/**
 * What each workspace role may do with the guest roster.
 *
 * This is policy, not fixture data: the server actions enforce the same matrix
 * through `GUEST_READ_ROLES` / `GUEST_WRITE_ROLES`, and the UI uses this set to
 * hide actions the signed-in role cannot perform. Keeping it here means the
 * loaders and the forms cannot disagree about a role's abilities.
 */
export const capabilitiesByRole: Record<GuestRole, GuestCapabilitySet> = {
  OWNER: {
    canRead: true,
    canWrite: true,
    canManageLink: true,
    canImport: true,
    canExport: true,
  },
  EDITOR: {
    canRead: true,
    canWrite: true,
    canManageLink: true,
    canImport: true,
    canExport: true,
  },
  VIEWER: {
    canRead: true,
    canWrite: false,
    canManageLink: false,
    canImport: false,
    canExport: false,
  },
};

export function getGuestCapabilitySet(role: GuestRole): GuestCapabilitySet {
  return capabilitiesByRole[role];
}
