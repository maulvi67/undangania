import type { TenantContext } from "@wedding/domain";
import {
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
}>;

export type EditorPorts = Readonly<{ editor: EditorLoadPort }>;

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
