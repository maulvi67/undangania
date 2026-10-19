import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";
import { DatabaseRepositoryUnavailableError } from "./qris-notification";

/**
 * Invitation editor persistence.
 *
 * The draft body lives in `Invitation.draftConfig`, an opaque JSON blob owned by
 * the editor domain. This package deliberately does not validate its shape — the
 * editor contract in the application layer does that — so nothing here imports
 * app-level schemas and the JSON is passed through as `Prisma.JsonValue`.
 *
 * Two invariants drive the design:
 *
 *   1. Concurrent edits must not silently overwrite each other. The version
 *      guard is the `where` clause of the write itself (compare-and-swap on
 *      `optimisticVersion`), not a read followed by a write. A read-then-write
 *      would leave a window where two editors both pass the check.
 *
 *   2. At most one publication may be active, but the schema only has a plain
 *      index on `active` — no unique constraint enforces it. Publish therefore
 *      demotes every active row before promoting the new one, inside a single
 *      transaction, so the invariant holds on commit rather than by luck.
 *
 * Single-row lookups use `findFirst` rather than `findUnique` so the `where`
 * clause can carry tenant scope and the hand-declared delegate shapes below stay
 * usable for dependency injection.
 */

const PUBLISHABLE_STATUSES = ["DRAFT", "PUBLISHED"] as const;

const editorInvitationSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  templateId: true,
  templateVersion: true,
  slug: true,
  status: true,
  draftConfig: true,
  optimisticVersion: true,
  updatedAt: true,
} as const satisfies Prisma.InvitationSelect;

type EditorInvitationRow = Prisma.InvitationGetPayload<{
  select: typeof editorInvitationSelect;
}>;

const editorTemplateSelect = {
  id: true,
  version: true,
  name: true,
  category: true,
  manifest: true,
} as const satisfies Prisma.TemplateSelect;

type EditorTemplateRow = Prisma.TemplateGetPayload<{
  select: typeof editorTemplateSelect;
}>;

const publicationVersionSelect = {
  id: true,
  publicationVersion: true,
} as const satisfies Prisma.InvitationPublicationSelect;

const publicationSelect = {
  id: true,
  publicationVersion: true,
  active: true,
  publishedAt: true,
  templateId: true,
  templateVersion: true,
  contractVersion: true,
} as const satisfies Prisma.InvitationPublicationSelect;

type PublicationRow = Prisma.InvitationPublicationGetPayload<{
  select: typeof publicationSelect;
}>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects.
 * A real Prisma client is adapted by `adaptEditorClient` rather than cast into
 * place: Prisma's delegate methods are generic over `SelectSubset`, so comparing
 * them against a concrete signature is not sound.
 */
type EditorInvitationClient = Readonly<{
  invitation: {
    findFirst(args: {
      where: Prisma.InvitationWhereInput;
      select: typeof editorInvitationSelect;
    }): Promise<EditorInvitationRow | null>;
    updateMany(args: {
      where: Prisma.InvitationWhereInput;
      data: Prisma.InvitationUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
}>;

type EditorTemplateClient = Readonly<{
  template: {
    findFirst(args: {
      where: Prisma.TemplateWhereInput;
      select: typeof editorTemplateSelect;
    }): Promise<EditorTemplateRow | null>;
  };
}>;

type EditorPublicationClient = Readonly<{
  invitationPublication: {
    findFirst(args: {
      where: Prisma.InvitationPublicationWhereInput;
      orderBy: Prisma.InvitationPublicationOrderByWithRelationInput;
      select: typeof publicationVersionSelect;
    }): Promise<{ id: string; publicationVersion: number } | null>;
    updateMany(args: {
      where: Prisma.InvitationPublicationWhereInput;
      data: Prisma.InvitationPublicationUpdateManyMutationInput;
    }): Promise<{ count: number }>;
    create(args: {
      data: Prisma.InvitationPublicationUncheckedCreateInput;
      select: typeof publicationSelect;
    }): Promise<PublicationRow>;
  };
}>;

export type EditorTransactionClient = EditorInvitationClient &
  EditorTemplateClient &
  EditorPublicationClient;

/**
 * Adapts a real Prisma client (or transaction client) to the narrow shape above.
 * Each method is passed through in a lambda so the generic delegate signature is
 * checked against concrete arguments instead of being compared structurally.
 */
export function adaptEditorClient(
  client: Pick<
    PrismaClient,
    "invitation" | "template" | "invitationPublication"
  >,
): EditorTransactionClient {
  return {
    invitation: {
      findFirst: (args) => client.invitation.findFirst(args),
      updateMany: (args) => client.invitation.updateMany(args),
    },
    template: {
      findFirst: (args) => client.template.findFirst(args),
    },
    invitationPublication: {
      findFirst: (args) => client.invitationPublication.findFirst(args),
      updateMany: (args) => client.invitationPublication.updateMany(args),
      create: (args) => client.invitationPublication.create(args),
    },
  };
}

export type EditorScope = Readonly<{
  tenantId: string;
  invitationId: string;
  /** Recorded as `publishedBy` and used for audit correlation. */
  actorId: string;
}>;

export type EditorDocumentDto = Readonly<{
  invitationId: string;
  version: number;
  updatedAt: Date;
  content: Prisma.JsonValue;
}>;

export type EditorInvitationDto = Readonly<{
  invitationId: string;
  tenantId: string;
  weddingId: string;
  templateId: string;
  templateVersion: string;
  slug: string;
  status: string;
  document: EditorDocumentDto;
}>;

export type EditorTemplateDto = Readonly<{
  id: string;
  version: string;
  name: string;
  category: string;
  manifest: Prisma.JsonValue;
}>;

export type EditorLoadDto = Readonly<{
  invitation: EditorInvitationDto;
  template: EditorTemplateDto;
}>;

export type EditorSaveResult =
  | Readonly<{ kind: "saved"; document: EditorDocumentDto }>
  | Readonly<{ kind: "stale"; serverDocument: EditorDocumentDto }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid" }>;

export type EditorPublishResult =
  | Readonly<{
      kind: "published";
      publicationId: string;
      publicationVersion: number;
    }>
  | Readonly<{ kind: "stale"; currentVersion: number }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "template-unavailable" }>
  | Readonly<{ kind: "invalid" }>;

export type EditorLifecycleResult =
  | Readonly<{ kind: "paused" }>
  | Readonly<{ kind: "resumed" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid" }>;

export type EditorSaveInput = Readonly<{
  /** Editor document body. Opaque to this layer by design. */
  content: Prisma.InputJsonValue;
  baseVersion: number;
}>;

export type EditorPublishInput = Readonly<{
  /** Rendered snapshot produced by the template engine. */
  snapshot: Prisma.InputJsonValue;
  /** Draft version the caller believes it is publishing. */
  baseVersion: number;
}>;

/**
 * A value that survives a JSON column round trip.
 *
 * The editor's own contracts type draft bodies as `unknown`, which is correct:
 * what a draft contains is not storage's business. But a JSON column can only
 * hold JSON, so the boundary has to be able to say whether a body qualifies. A
 * structural check is used rather than an assertion because a body carrying a
 * function, a `Date`, or a cycle would otherwise fail deep inside Prisma as an
 * opaque error instead of a validation failure the caller can report.
 *
 * Note that `undefined` is not JSON: an object property holding it is dropped by
 * `JSON.stringify`, so a body which round-trips to something different from what
 * was written is rejected here rather than silently altered.
 */
export function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  return isJson(value, new Set());
}

function isJson(value: unknown, seen: Set<object>): boolean {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;

  // A cycle cannot be serialized; a shared but acyclic reference can, so the
  // tracking set is unwound on the way back out.
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    if (value instanceof Date) return false;
    if (Array.isArray(value)) {
      return value.every((entry) => entry !== undefined && isJson(entry, seen));
    }
    return Object.values(value).every(
      (entry) => entry !== undefined && isJson(entry, seen),
    );
  } finally {
    seen.delete(value);
  }
}

export interface EditorRepository {
  load(scope: EditorScope): Promise<EditorLoadDto | null>;
  save(scope: EditorScope, input: EditorSaveInput): Promise<EditorSaveResult>;
  publish(
    scope: EditorScope,
    input: EditorPublishInput,
  ): Promise<EditorPublishResult>;
  setActive(
    scope: EditorScope,
    input: Readonly<{ active: boolean }>,
  ): Promise<EditorLifecycleResult>;
}

export type EditorRepositories = Readonly<{ editor: EditorRepository }>;

export type EditorTransactionPort = Readonly<{
  transaction<T>(
    work: (repositories: EditorRepositories) => Promise<T>,
  ): Promise<T>;
}>;

function toEditorDocumentDto(row: EditorInvitationRow): EditorDocumentDto {
  return {
    invitationId: row.id,
    version: row.optimisticVersion,
    updatedAt: row.updatedAt,
    content: row.draftConfig,
  };
}

function toEditorInvitationDto(row: EditorInvitationRow): EditorInvitationDto {
  return {
    invitationId: row.id,
    tenantId: row.tenantId,
    weddingId: row.weddingId,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    slug: row.slug,
    status: row.status,
    document: toEditorDocumentDto(row),
  };
}

function toEditorTemplateDto(row: EditorTemplateRow): EditorTemplateDto {
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    category: row.category,
    manifest: row.manifest,
  };
}

/**
 * Scope that is repeated on every read and write. `Invitation` carries its own
 * `tenantId`, and the parent relation is asserted redundantly so a mis-scoped
 * identifier cannot reach rows outside the tenant even if the column were wrong.
 */
function invitationScope(scope: EditorScope): Prisma.InvitationWhereInput {
  return {
    id: scope.invitationId,
    tenantId: scope.tenantId,
    wedding: { tenantId: scope.tenantId },
  };
}

export function isPublishableStatus(status: string): boolean {
  return (PUBLISHABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * `Template.manifest` is opaque JSON. The publication row needs its
 * `contractVersion`, so it is read defensively: a manifest without a usable
 * integer must not be able to publish a snapshot under a fabricated contract.
 */
export function readContractVersion(manifest: Prisma.JsonValue): number | null {
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest)
  ) {
    return null;
  }

  const value = (manifest as Record<string, unknown>).contractVersion;
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * Publication versions are per invitation and must increase by one from the
 * highest existing row. The unique constraint on
 * `[invitationId, publicationVersion]` is the backstop: two concurrent
 * publishes that compute the same next version cannot both commit, and the
 * loser surfaces as an unavailable error the caller may retry.
 */
export function nextPublicationVersion(
  latest: Readonly<{ publicationVersion: number }> | null,
): number {
  return (latest?.publicationVersion ?? 0) + 1;
}

export class PrismaEditorRepository implements EditorRepository {
  public constructor(
    private readonly client: EditorTransactionClient = adaptEditorClient(
      prisma,
    ),
  ) {}

  public async load(scope: EditorScope): Promise<EditorLoadDto | null> {
    const invitation = await this.client.invitation.findFirst({
      where: invitationScope(scope),
      select: editorInvitationSelect,
    });
    if (invitation === null) return null;

    const template = await this.client.template.findFirst({
      where: {
        id: invitation.templateId,
        version: invitation.templateVersion,
      },
      select: editorTemplateSelect,
    });
    // The composite FK `[templateId, templateVersion]` guarantees a row, so a
    // miss here means the schema and the query disagree.
    if (template === null) throw new DatabaseRepositoryUnavailableError();

    return {
      invitation: toEditorInvitationDto(invitation),
      template: toEditorTemplateDto(template),
    };
  }

  public async save(
    scope: EditorScope,
    input: EditorSaveInput,
  ): Promise<EditorSaveResult> {
    if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) {
      return { kind: "invalid" };
    }

    // Compare-and-swap. The version lives in the `where` clause so the guard and
    // the write are one statement: two concurrent saves cannot both succeed, and
    // neither needs a lock held across round trips.
    const result = await this.client.invitation.updateMany({
      where: {
        ...invitationScope(scope),
        optimisticVersion: input.baseVersion,
      },
      data: {
        draftConfig: input.content,
        optimisticVersion: input.baseVersion + 1,
      },
    });

    if (result.count === 1) {
      // `updatedAt` is maintained by the database, so the authoritative value is
      // only known after the write. Read back rather than invent a timestamp.
      const saved = await this.client.invitation.findFirst({
        where: invitationScope(scope),
        select: editorInvitationSelect,
      });
      if (saved === null) return { kind: "not-found" };
      return { kind: "saved", document: toEditorDocumentDto(saved) };
    }

    // Zero rows means either the invitation is not in scope or the version
    // moved. Distinguish them so a cross-tenant write reports not-found instead
    // of leaking that the row exists under another version.
    const current = await this.client.invitation.findFirst({
      where: invitationScope(scope),
      select: editorInvitationSelect,
    });
    if (current === null) return { kind: "not-found" };

    return {
      kind: "stale",
      serverDocument: toEditorDocumentDto(current),
    };
  }

  public async publish(
    scope: EditorScope,
    input: EditorPublishInput,
  ): Promise<EditorPublishResult> {
    if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) {
      return { kind: "invalid" };
    }

    const invitation = await this.client.invitation.findFirst({
      where: invitationScope(scope),
      select: editorInvitationSelect,
    });
    if (invitation === null) return { kind: "not-found" };

    // Publishing a draft the caller has never seen would ship content the author
    // did not review.
    if (invitation.optimisticVersion !== input.baseVersion) {
      return { kind: "stale", currentVersion: invitation.optimisticVersion };
    }

    if (!isPublishableStatus(invitation.status)) {
      return { kind: "invalid" };
    }

    const template = await this.client.template.findFirst({
      where: {
        id: invitation.templateId,
        version: invitation.templateVersion,
      },
      select: editorTemplateSelect,
    });
    if (template === null) return { kind: "template-unavailable" };

    const contractVersion = readContractVersion(template.manifest);
    if (contractVersion === null) return { kind: "template-unavailable" };

    const latest = await this.client.invitationPublication.findFirst({
      where: {
        tenantId: scope.tenantId,
        invitationId: invitation.id,
      },
      orderBy: { publicationVersion: "desc" },
      select: publicationVersionSelect,
    });
    const publicationVersion = nextPublicationVersion(latest);

    // Demote first. The schema cannot enforce a single active row, so every
    // active publication is stood down before the new one is promoted; doing it
    // in this order means the post-commit state is correct even if the two
    // statements were ever to run outside a transaction.
    await this.client.invitationPublication.updateMany({
      where: { tenantId: scope.tenantId, invitationId: invitation.id },
      data: { active: false },
    });

    const created = await this.client.invitationPublication.create({
      data: {
        tenantId: scope.tenantId,
        invitationId: invitation.id,
        publicationVersion,
        snapshot: input.snapshot,
        // Template binding is snapshotted from the stored invitation, never from
        // the caller, so a publish cannot claim a template the invitation is not
        // actually bound to.
        templateId: invitation.templateId,
        templateVersion: invitation.templateVersion,
        contractVersion,
        active: true,
        publishedBy: scope.actorId,
      },
      select: publicationSelect,
    });

    return {
      kind: "published",
      publicationId: created.id,
      publicationVersion: created.publicationVersion,
    };
  }

  public async setActive(
    scope: EditorScope,
    input: Readonly<{ active: boolean }>,
  ): Promise<EditorLifecycleResult> {
    const invitation = await this.client.invitation.findFirst({
      where: invitationScope(scope),
      select: editorInvitationSelect,
    });
    if (invitation === null) return { kind: "not-found" };

    if (input.active) {
      if (invitation.status === "PUBLISHED") return { kind: "resumed" };
      if (invitation.status !== "PAUSED") return { kind: "invalid" };

      const latest = await this.client.invitationPublication.findFirst({
        where: {
          tenantId: scope.tenantId,
          invitationId: invitation.id,
        },
        orderBy: { publicationVersion: "desc" },
        select: publicationVersionSelect,
      });
      if (latest === null) return { kind: "invalid" };

      // Promote the snapshot first. The public reader still checks the invitation
      // status, so a failure before the status update leaves the page hidden
      // rather than exposing it with a paused state.
      await this.client.invitationPublication.updateMany({
        where: { tenantId: scope.tenantId, invitationId: invitation.id },
        data: { active: false },
      });
      await this.client.invitationPublication.updateMany({
        where: {
          tenantId: scope.tenantId,
          invitationId: invitation.id,
          id: latest.id,
        },
        data: { active: true },
      });

      const updated = await this.client.invitation.updateMany({
        where: { ...invitationScope(scope), status: "PAUSED" },
        data: { status: "PUBLISHED" },
      });
      return updated.count === 1 ? { kind: "resumed" } : { kind: "invalid" };
    }

    if (invitation.status === "PAUSED") return { kind: "paused" };
    if (invitation.status !== "PUBLISHED") return { kind: "invalid" };

    // Taking the page down is the first write, so a later failure cannot leave an
    // active publication reachable through a published invitation.
    const updated = await this.client.invitation.updateMany({
      where: { ...invitationScope(scope), status: "PUBLISHED" },
      data: { status: "PAUSED" },
    });
    if (updated.count !== 1) return { kind: "invalid" };

    await this.client.invitationPublication.updateMany({
      where: { tenantId: scope.tenantId, invitationId: invitation.id },
      data: { active: false },
    });
    return { kind: "paused" };
  }
}

function createRepositories(
  client: EditorTransactionClient,
): EditorRepositories {
  return { editor: new PrismaEditorRepository(client) };
}

export class PrismaEditorTransaction implements EditorTransactionPort {
  public constructor(
    private readonly client: Pick<PrismaClient, "$transaction"> = prisma,
  ) {}

  public async transaction<T>(
    work: (repositories: EditorRepositories) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.$transaction(async (transactionClient) =>
        work(createRepositories(adaptEditorClient(transactionClient))),
      );
    } catch (error) {
      if (error instanceof DatabaseRepositoryUnavailableError) throw error;
      throw new DatabaseRepositoryUnavailableError();
    }
  }
}
