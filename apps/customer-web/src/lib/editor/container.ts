import { PrismaEditorRepository, isJsonValue } from "@wedding/database";
import type {
  EditorDocument,
  EditorLoadPort,
  EditorPorts,
  EditorTemplate,
} from "@wedding/application";

/**
 * Composition root for the invitation editor use-cases.
 *
 * The use-cases in `@wedding/application` declare structural ports and must not
 * import `@wedding/database`; this module is the single place that binds them.
 *
 * The draft body and the published snapshot are typed `unknown` by the
 * application contract on purpose — what they contain is the editor contract's
 * business, and the application layer refuses to know. Storage needs a
 * serializable JSON value, so the narrowing happens here, at the one boundary
 * that actually has to satisfy the database.
 */

function toDocument(
  document: Readonly<{
    invitationId: string;
    version: number;
    updatedAt: Date;
    content: unknown;
  }>,
): EditorDocument {
  return {
    invitationId: document.invitationId,
    version: document.version,
    updatedAt: document.updatedAt,
    content: document.content,
  };
}

function toTemplate(
  template: Readonly<{
    id: string;
    version: string;
    name: string;
    category: string;
    manifest: unknown;
  }>,
): EditorTemplate {
  return {
    id: template.id,
    version: template.version,
    name: template.name,
    category: template.category,
    manifest: template.manifest,
  };
}

function editorPort(): EditorLoadPort {
  const repository = new PrismaEditorRepository();

  return {
    load: async (scope) => {
      const loaded = await repository.load(scope);
      if (loaded === null) return null;

      return {
        invitation: {
          invitationId: loaded.invitation.invitationId,
          tenantId: loaded.invitation.tenantId,
          weddingId: loaded.invitation.weddingId,
          templateId: loaded.invitation.templateId,
          templateVersion: loaded.invitation.templateVersion,
          slug: loaded.invitation.slug,
          status: loaded.invitation.status,
          document: toDocument(loaded.invitation.document),
        },
        template: toTemplate(loaded.template),
      };
    },

    save: async (scope, input) => {
      // A body a JSON column cannot hold is a contract violation, not a storage
      // failure: reporting `invalid` lets the caller show a validation message
      // instead of dying inside Prisma.
      if (!isJsonValue(input.content)) return { kind: "invalid" };

      const result = await repository.save(scope, {
        content: input.content,
        baseVersion: input.baseVersion,
      });

      switch (result.kind) {
        case "saved":
          return { kind: "saved", document: toDocument(result.document) };
        case "stale":
          return {
            kind: "stale",
            serverDocument: toDocument(result.serverDocument),
          };
        case "not-found":
        case "invalid":
        default:
          return result;
      }
    },

    publish: async (scope, input) => {
      if (!isJsonValue(input.snapshot)) return { kind: "invalid" };

      return repository.publish(scope, {
        snapshot: input.snapshot,
        baseVersion: input.baseVersion,
      });
    },
  };
}

export function getEditorPorts(): EditorPorts {
  return { editor: editorPort() };
}
