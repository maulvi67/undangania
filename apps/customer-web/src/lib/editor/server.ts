import { PrismaInvitationProvisioningRepository } from "@wedding/database";
import {
  loadEditorDocument,
  publishInvitation,
  saveEditorDocument,
  StaleVersionError,
  UnavailableError,
  InvalidInputError,
  NotFoundError,
} from "@wedding/application";
import {
  invitationViewModelSchema,
  templateManifestSchema,
} from "@wedding/template-engine";
import type { TemplateManifest } from "@wedding/template-engine";
import type { z } from "zod";
import {
  editorDocumentSchema,
  type EditorDocument,
  type EditorTemplate,
} from "./contract";
import { getEditorPorts } from "./container";
import { ensureTemplatePersisted } from "../templates/catalogue";
import {
  resolveSessionWorkspaceOrNull,
  type SessionWorkspace,
} from "../workspace/session-workspace";

/**
 * Editor persistence against the session's own invitation.
 *
 * This is the production transport: the invitation is addressed by the workspace
 * the session owns, never by a value from the request, and the draft body is
 * validated by the same contract the UI uses before it is accepted.
 *
 * On a first visit there is no invitation yet — the couple has not chosen a
 * design — so the template named in the query string is persisted and bound to
 * the wedding. Only a known, ACTIVE design is accepted; anything else is reported
 * as "choose a design" rather than opening an editor with no template behind it.
 */

export type EditorSessionResolution =
  | Readonly<{
      kind: "ok";
      workspace: SessionWorkspace;
      invitationId: string;
      templateId: string;
    }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "template-unavailable" }>;

/**
 * Resolves the invitation this session should edit, provisioning it against
 * `templateId` when the wedding does not have one yet.
 *
 * An existing invitation always wins: opening the editor with a different
 * `?template=` must not silently re-bind content the couple has already written.
 * Switching designs is a deliberate action with its own confirmation.
 */
export async function resolveEditorSession(
  templateId: string,
): Promise<EditorSessionResolution> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "forbidden" };

  if (workspace.invitationId !== null) {
    return {
      kind: "ok",
      workspace,
      invitationId: workspace.invitationId,
      templateId,
    };
  }

  // The composite foreign key needs the catalogue row before the invitation can
  // exist, so the design is persisted first.
  const known = await ensureTemplatePersisted(templateId);
  if (!known) return { kind: "template-unavailable" };

  const provisioned = await new PrismaInvitationProvisioningRepository().ensure(
    {
      tenantId: workspace.context.tenantId,
      weddingId: workspace.weddingId,
      templateId,
    },
  );
  if (provisioned.kind === "template-unavailable") {
    return { kind: "template-unavailable" };
  }
  // The wedding was checked to exist before the insert, so a miss here means it
  // was deleted mid-request; there is no invitation to open.
  if (provisioned.kind === "not-found") {
    return { kind: "template-unavailable" };
  }

  return {
    kind: "ok",
    workspace,
    invitationId: provisioned.invitation.invitationId,
    templateId: provisioned.invitation.templateId,
  };
}

/**
 * The roles the editor use-cases authorize against come from the authenticated
 * membership, not from a literal: an empty list would make every call fail its
 * own check.
 */
function tenantContextFor(workspace: SessionWorkspace) {
  return workspace.context;
}

/**
 * Copies a parsed manifest into the editor's contract type.
 *
 * The optional collections are omitted when unset rather than assigned
 * `undefined`, because `exactOptionalPropertyTypes` distinguishes the two and the
 * editor's type models them as genuinely optional.
 */
function toEditorManifest(
  manifest: z.infer<typeof templateManifestSchema>,
): TemplateManifest {
  return {
    id: manifest.id,
    version: manifest.version,
    contractVersion: manifest.contractVersion,
    name: manifest.name,
    category: manifest.category,
    supportedSections: manifest.supportedSections,
    ...(manifest.requiredSections === undefined
      ? {}
      : { requiredSections: manifest.requiredSections }),
    ...(manifest.reorderableSections === undefined
      ? {}
      : { reorderableSections: manifest.reorderableSections }),
    ...(manifest.sectionOrder === undefined
      ? {}
      : { sectionOrder: manifest.sectionOrder }),
  };
}

export type EditorLoadOutcome =
  | Readonly<{
      kind: "ok";
      document: EditorDocument;
      template: EditorTemplate;
    }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Loads the stored draft for a resolved session.
 *
 * A draft that fails its own schema is reported as unavailable rather than
 * replaced with defaults: overwriting a body the contract cannot read would
 * discard the only copy of the couple's work.
 */
export async function loadEditorForSession(
  session: Extract<EditorSessionResolution, { kind: "ok" }>,
): Promise<EditorLoadOutcome> {
  try {
    const loaded = await loadEditorDocument(
      tenantContextFor(session.workspace),
      { invitationId: session.invitationId },
      getEditorPorts(),
    );

    const manifest = templateManifestSchema.safeParse(loaded.template.manifest);
    // Publishing reads `contractVersion` from the manifest, so a manifest this
    // contract cannot parse means the design is unusable rather than merely new.
    if (!manifest.success) return { kind: "unavailable" };

    const document = editorDocumentSchema.safeParse({
      invitationId: loaded.invitation.invitationId,
      version: loaded.invitation.document.version,
      updatedAt: loaded.invitation.document.updatedAt.toISOString(),
      content: loaded.invitation.document.content,
    });
    if (!document.success) return { kind: "unavailable" };

    return {
      kind: "ok",
      document: document.data,
      template: {
        id: loaded.template.id,
        version: loaded.template.version,
        name: loaded.template.name,
        // The parsed manifest is spread rather than assigned wholesale so the
        // optional collections are absent when unset. `exactOptionalPropertyTypes`
        // distinguishes "absent" from "present and undefined", and the editor's
        // contract models them as genuinely optional.
        manifest: toEditorManifest(manifest.data),
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export type EditorPublishOutcome =
  | Readonly<{ kind: "published"; publicationId: string; slug: string }>
  | Readonly<{ kind: "stale" }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "provider-unavailable" }>;

/**
 * Publishes the rendered snapshot of a draft.
 *
 * The snapshot is supplied by the caller because it is the template engine's
 * output, which is a separate concern from storage. `publishInvitation` records it
 * against the template the invitation is actually bound to — it never accepts a
 * template id — so a publish cannot claim a design the invitation does not have.
 *
 * The row's own `active` flag is what makes the snapshot reachable at the public
 * URL, so only a successful publish makes the invitation visible.
 */
export async function publishEditorForSession(
  session: Extract<EditorSessionResolution, { kind: "ok" }>,
  input: { snapshot: unknown; baseVersion: number },
): Promise<EditorPublishOutcome> {
  const parsed = invitationViewModelSchema.safeParse(input.snapshot);
  // A snapshot that the current contract cannot describe would render as a broken
  // public page, so it is refused before it is stored.
  if (!parsed.success) return { kind: "invalid" };

  try {
    const result = await publishInvitation(
      tenantContextFor(session.workspace),
      {
        invitationId: session.invitationId,
        snapshot: parsed.data,
        baseVersion: input.baseVersion,
      },
      getEditorPorts(),
    );

    return {
      kind: "published",
      publicationId: result.publicationId,
      slug: session.workspace.invitationSlug ?? "",
    };
  } catch (error) {
    if (error instanceof StaleVersionError) return { kind: "stale" };
    // Completion rules the editor already surfaced are reported as invalid so the
    // panel can re-list them rather than claiming an outage.
    if (error instanceof InvalidInputError) return { kind: "invalid" };
    if (error instanceof NotFoundError) return { kind: "forbidden" };
    if (error instanceof UnavailableError)
      return { kind: "provider-unavailable" };
    return { kind: "provider-unavailable" };
  }
}

export type EditorSaveOutcome =
  | Readonly<{ kind: "saved"; document: EditorDocument }>
  | Readonly<{ kind: "stale"; serverDocument: EditorDocument }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "provider-unavailable" }>;

/**
 * Persists a draft for a resolved session.
 *
 * The body is validated before the write, and its `invitationId` must match the
 * session's invitation, so a crafted body cannot address a different row.
 */
export async function saveEditorForSession(
  session: Extract<EditorSessionResolution, { kind: "ok" }>,
  input: { document: unknown; baseVersion: number },
): Promise<EditorSaveOutcome> {
  const parsed = editorDocumentSchema.safeParse(input.document);
  if (!parsed.success) return { kind: "invalid" };
  if (parsed.data.invitationId !== session.invitationId) {
    return { kind: "forbidden" };
  }

  try {
    const saved = await saveEditorDocument(
      tenantContextFor(session.workspace),
      {
        invitationId: session.invitationId,
        content: parsed.data.content,
        baseVersion: input.baseVersion,
      },
      getEditorPorts(),
    );

    return {
      kind: "saved",
      document: {
        invitationId: saved.invitationId,
        version: saved.version,
        updatedAt: saved.updatedAt.toISOString(),
        content: parsed.data.content,
      },
    };
  } catch (error) {
    if (!(error instanceof StaleVersionError)) {
      return { kind: "provider-unavailable" };
    }

    // The conflict carries no body by design, so the authoritative document is
    // re-read: the client needs it to merge, and inventing one would silently
    // discard the other writer's work.
    const reloaded = await loadEditorForSession(session);
    return reloaded.kind === "ok"
      ? { kind: "stale", serverDocument: reloaded.document }
      : { kind: "provider-unavailable" };
  }
}
