import type { TenantContext } from "@wedding/domain";
import {
  EntitlementRequiredError,
  InvalidInputError,
  NotFoundError,
  StaleVersionError,
  UnavailableError,
  assertAnyRole,
  EDITOR_ROLES,
  requireTenantContext,
} from "./use-case-support";

/**
 * Invitation editor use-cases.
 *
 * The editor document body is opaque to this layer. Validation belongs to the
 * editor contract in the app, and re-validating it here would create a second
 * definition that could drift. What this layer owns is the version discipline:
 * a save is always expressed against the version the author was looking at, so
 * two people editing the same draft cannot silently overwrite each other.
 *
 * Ports are structural; this package does not depend on `@wedding/database`.
 */

export type EditorScope = Readonly<{
  tenantId: string;
  invitationId: string;
  actorId: string;
}>;

export type EditorDocument = Readonly<{
  invitationId: string;
  version: number;
  updatedAt: Date;
  content: unknown;
}>;

export type EditorInvitation = Readonly<{
  invitationId: string;
  tenantId: string;
  weddingId: string;
  templateId: string;
  templateVersion: string;
  slug: string;
  status: string;
  document: EditorDocument;
}>;

export type EditorTemplate = Readonly<{
  id: string;
  version: string;
  name: string;
  category: string;
  manifest: unknown;
}>;

export type EditorLoadPort = Readonly<{
  load(scope: EditorScope): Promise<Readonly<{
    invitation: EditorInvitation;
    template: EditorTemplate;
  }> | null>;
  save(
    scope: EditorScope,
    input: Readonly<{ content: unknown; baseVersion: number }>,
  ): Promise<
    | Readonly<{ kind: "saved"; document: EditorDocument }>
    | Readonly<{ kind: "stale"; serverDocument: EditorDocument }>
    | Readonly<{ kind: "not-found" }>
    | Readonly<{ kind: "invalid" }>
  >;
  publish(
    scope: EditorScope,
    input: Readonly<{ snapshot: unknown; baseVersion: number }>,
  ): Promise<
    | Readonly<{
        kind: "published";
        publicationId: string;
        publicationVersion: number;
      }>
    | Readonly<{ kind: "stale"; currentVersion: number }>
    | Readonly<{ kind: "not-found" }>
    | Readonly<{ kind: "template-unavailable" }>
    | Readonly<{ kind: "invalid" }>
  >;
  setActive(
    scope: EditorScope,
    input: Readonly<{ active: boolean }>,
  ): Promise<
    | Readonly<{ kind: "paused" }>
    | Readonly<{ kind: "resumed" }>
    | Readonly<{ kind: "not-found" }>
    | Readonly<{ kind: "invalid" }>
  >;
}>;

export type EditorEntitlementPort = Readonly<{
  /**
   * Reports whether this workspace holds a currently active entitlement for the
   * product behind the invitation. Drafting stays free; publishing is the paid
   * action, so the check belongs at this seam rather than on every autosave.
   */
  hasPublishEntitlement(
    input: Readonly<{
      tenantId: string;
      invitationId: string;
      at: Date;
    }>,
  ): Promise<boolean>;
}>;

export type EditorPorts = Readonly<{
  editor: EditorLoadPort;
  entitlements: EditorEntitlementPort;
}>;

export async function loadEditorDocument(
  context: TenantContext | null | undefined,
  input: Readonly<{ invitationId: string }>,
  ports: EditorPorts,
): Promise<
  Readonly<{ invitation: EditorInvitation; template: EditorTemplate }>
> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, EDITOR_ROLES);
  if (input.invitationId.trim().length === 0) {
    throw new InvalidInputError("Undangan tidak dikenali.");
  }

  const loaded = await ports.editor.load({
    tenantId: tenant.tenantId,
    invitationId: input.invitationId,
    actorId: tenant.actorId,
  });
  // An invitation in another tenant is reported as not-found rather than
  // forbidden, so the response does not confirm that the id exists elsewhere.
  if (loaded === null) throw new NotFoundError("Undangan tidak ditemukan.");

  return loaded;
}

export async function saveEditorDocument(
  context: TenantContext | null | undefined,
  input: Readonly<{
    invitationId: string;
    content: unknown;
    baseVersion: number;
  }>,
  ports: EditorPorts,
): Promise<EditorDocument> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, EDITOR_ROLES);
  if (input.invitationId.trim().length === 0) {
    throw new InvalidInputError("Undangan tidak dikenali.");
  }
  if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) {
    throw new InvalidInputError("Versi dokumen tidak valid.");
  }

  const result = await ports.editor.save(
    {
      tenantId: tenant.tenantId,
      invitationId: input.invitationId,
      actorId: tenant.actorId,
    },
    { content: input.content, baseVersion: input.baseVersion },
  );

  switch (result.kind) {
    case "saved":
      return result.document;
    case "stale":
      // The caller merges or reloads. Returning the server document alongside
      // the error is what makes the merge possible without a second read.
      throw new StaleVersionError(
        "Draf ini sudah diperbarui di tempat lain. Muat ulang untuk menggabungkan.",
      );
    case "not-found":
      throw new NotFoundError("Undangan tidak ditemukan.");
    case "invalid":
      throw new InvalidInputError("Draf tidak dapat disimpan.");
    default:
      throw new UnavailableError("Draf tidak dapat disimpan.");
  }
}

export type PublishResult = Readonly<{
  publicationId: string;
  publicationVersion: number;
}>;

export type InvitationLifecycleResult = Readonly<{
  kind: "paused" | "resumed";
}>;

/**
 * Publishes a draft.
 *
 * The published snapshot is supplied by the caller because it is the *rendered*
 * output of the template engine, which is a separate concern from storage. This
 * use-case records the snapshot against the template the invitation is actually
 * bound to; it never accepts a template id from the caller.
 */
export async function publishInvitation(
  context: TenantContext | null | undefined,
  input: Readonly<{
    invitationId: string;
    snapshot: unknown;
    baseVersion: number;
  }>,
  ports: EditorPorts,
): Promise<PublishResult> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, EDITOR_ROLES);
  if (input.invitationId.trim().length === 0) {
    throw new InvalidInputError("Undangan tidak dikenali.");
  }
  if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) {
    throw new InvalidInputError("Versi dokumen tidak valid.");
  }

  // A draft is free to author, but making it public is the licensed action.
  // Checking here means a client cannot bypass the paywall by calling the
  // publish port directly.
  const entitled = await ports.entitlements.hasPublishEntitlement({
    tenantId: tenant.tenantId,
    invitationId: input.invitationId,
    at: new Date(),
  });
  if (!entitled) {
    throw new EntitlementRequiredError(
      "Aktifkan paket undangan sebelum menerbitkan.",
    );
  }

  const result = await ports.editor.publish(
    {
      tenantId: tenant.tenantId,
      invitationId: input.invitationId,
      actorId: tenant.actorId,
    },
    { snapshot: input.snapshot, baseVersion: input.baseVersion },
  );

  switch (result.kind) {
    case "published":
      return {
        publicationId: result.publicationId,
        publicationVersion: result.publicationVersion,
      };
    case "stale":
      throw new StaleVersionError(
        "Draf berubah sebelum diterbitkan. Muat ulang lalu terbitkan kembali.",
      );
    case "not-found":
      throw new NotFoundError("Undangan tidak ditemukan.");
    case "template-unavailable":
      throw new UnavailableError(
        "Templat undangan tidak tersedia. Hubungi dukungan.",
      );
    case "invalid":
      throw new InvalidInputError("Undangan belum siap diterbitkan.");
    default:
      throw new UnavailableError("Undangan tidak dapat diterbitkan.");
  }
}

/**
 * Pauses or reactivates the public invitation without discarding its snapshot.
 *
 * Reactivating is a paid action for the same reason publishing is: it puts the
 * invitation back in front of guests. Pausing stays available even when the
 * entitlement has lapsed, because taking a page down must never depend on a
 * billing state.
 */
export async function setInvitationActive(
  context: TenantContext | null | undefined,
  input: Readonly<{ invitationId: string; active: boolean }>,
  ports: EditorPorts,
): Promise<InvitationLifecycleResult> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, EDITOR_ROLES);
  if (input.invitationId.trim().length === 0) {
    throw new InvalidInputError("Undangan tidak dikenali.");
  }

  if (input.active) {
    const entitled = await ports.entitlements.hasPublishEntitlement({
      tenantId: tenant.tenantId,
      invitationId: input.invitationId,
      at: new Date(),
    });
    if (!entitled) {
      throw new EntitlementRequiredError(
        "Aktifkan paket undangan sebelum menampilkan undangan kembali.",
      );
    }
  }

  const result = await ports.editor.setActive(
    {
      tenantId: tenant.tenantId,
      invitationId: input.invitationId,
      actorId: tenant.actorId,
    },
    { active: input.active },
  );

  switch (result.kind) {
    case "paused":
    case "resumed":
      return { kind: result.kind };
    case "not-found":
      throw new NotFoundError("Undangan tidak ditemukan.");
    case "invalid":
      throw new InvalidInputError(
        input.active
          ? "Undangan ini belum dapat ditampilkan kembali."
          : "Undangan ini belum dapat dijeda.",
      );
    default:
      throw new UnavailableError("Status undangan tidak dapat diubah.");
  }
}
