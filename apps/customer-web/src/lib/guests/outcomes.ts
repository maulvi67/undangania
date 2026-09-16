import type { MemberRole } from "@wedding/application";
import type { GuestEvent } from "./contract";

/**
 * Shared shapes for the guest Server Actions.
 *
 * These live outside `actions.ts` because a `"use server"` module may only export
 * async functions — a re-exported type or constant makes the whole module fail to
 * compile at the call site.
 */

export const GUEST_IMPORT_MAX_ROWS = 500;

/** Roles that may read the guest roster. `VIEWER` reads but does not write. */
export const GUEST_READ_ROLES = [
  "OWNER",
  "EDITOR",
  "VIEWER",
] as const satisfies readonly MemberRole[];

/** Roles that may mutate the roster or the personalized link. */
export const GUEST_WRITE_ROLES = [
  "OWNER",
  "EDITOR",
] as const satisfies readonly MemberRole[];

export type GuestMutationOutcome =
  | Readonly<{ kind: "ok"; householdId: string }>
  | Readonly<{ kind: "invalid"; errors: readonly string[] }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "unavailable" }>;

export type GuestLinkOutcome =
  | Readonly<{
      kind: "ok";
      /** Shown once; the server keeps only the hash. */
      token: string;
      tokenVersion: number;
    }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "unavailable" }>;

export type GuestImportOutcome =
  | Readonly<{
      kind: "ok";
      createdHouseholds: number;
      createdGuests: number;
    }>
  | Readonly<{ kind: "invalid"; errors: readonly string[] }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;

export type GuestFormOptionsOutcome =
  | Readonly<{ kind: "ok"; events: readonly GuestEvent[] }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;
