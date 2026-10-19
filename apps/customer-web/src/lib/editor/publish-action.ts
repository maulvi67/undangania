"use server";

import { revalidatePath } from "next/cache";
import { invitationViewModelSchema } from "@wedding/template-engine";
import {
  publicationReadiness,
  toInvitationViewModel,
  type PublicationReadiness,
} from "./contract";
import { editorTemplateIdFromSearch } from "./template-param";
import {
  loadEditorForSession,
  publishEditorForSession,
  resolveEditorSession,
  setEditorInvitationActive,
} from "./server";
import { invalidatePublicInvitation } from "../public-invitation/publication-cache";

/**
 * Publishes the invitation at the session's own address.
 *
 * The snapshot is rendered from the **stored** draft, never from the request
 * body. Accepting a client-rendered snapshot would let a caller publish arbitrary
 * content under their own public slug — the slug is theirs, but the content is
 * subject to the readiness rules, and those rules must hold against what is
 * actually saved.
 *
 * `baseVersion` is the one value taken from the client, because only it knows
 * which revision the author was looking at when they pressed publish. That is
 * exactly what the use-case's version guard consumes: publishing a draft the
 * author has never seen is refused.
 */

export type PublishOutcome =
  | Readonly<{ kind: "published"; publicUrl: string }>
  | Readonly<{ kind: "not-ready"; readiness: PublicationReadiness }>
  | Readonly<{ kind: "stale"; readiness: PublicationReadiness | null }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "entitlement-required"; checkoutUrl: string }>
  | Readonly<{ kind: "unavailable" }>;

export type InvitationLifecycleOutcome =
  | Readonly<{ kind: "paused" | "resumed" }>
  | Readonly<{ kind: "forbidden" | "invalid" | "unavailable" }>
  | Readonly<{ kind: "entitlement-required"; checkoutUrl: string }>;

export async function setInvitationActiveAction(input: {
  active: boolean;
  templateId: string;
}): Promise<InvitationLifecycleOutcome> {
  const session = await resolveEditorSession(
    editorTemplateIdFromSearch(input.templateId),
  );
  if (session.kind !== "ok") return { kind: "forbidden" };

  const result = await setEditorInvitationActive(session, input.active);
  switch (result.kind) {
    case "paused":
    case "resumed": {
      const slug = session.workspace.invitationSlug;
      if (slug !== null) {
        await invalidatePublicInvitation(slug);
        revalidatePath(`/invite/${slug}`);
      }
      return { kind: result.kind };
    }
    case "entitlement-required":
      return {
        kind: "entitlement-required",
        checkoutUrl: `/checkout?template=${encodeURIComponent(input.templateId)}`,
      };
    case "invalid":
      return { kind: "invalid" };
    case "forbidden":
      return { kind: "forbidden" };
    default:
      return { kind: "unavailable" };
  }
}

export async function publishInvitationAction(input: {
  baseVersion: number;
  templateId: string;
}): Promise<PublishOutcome> {
  const session = await resolveEditorSession(
    editorTemplateIdFromSearch(input.templateId),
  );
  if (session.kind !== "ok") return { kind: "forbidden" };

  const loaded = await loadEditorForSession(session);
  if (loaded.kind !== "ok") return { kind: "unavailable" };

  // Checked against the stored draft rather than the form: the panel that shows
  // this list is an affordance, and a client that skips it must not be able to
  // publish an invitation the contract considers incomplete.
  const readiness = publicationReadiness(
    loaded.document.content,
    loaded.template.manifest,
  );
  if (!readiness.ready) return { kind: "not-ready", readiness };

  const snapshot = invitationViewModelSchema.safeParse(
    toInvitationViewModel(loaded.document.content),
  );
  // A draft that is ready but cannot be rendered is a template/contract problem,
  // not a validation message the author can act on.
  if (!snapshot.success) return { kind: "unavailable" };

  const result = await publishEditorForSession(session, {
    snapshot: snapshot.data,
    baseVersion: input.baseVersion,
  });

  switch (result.kind) {
    case "published": {
      if (result.slug !== "") {
        // The active publication row changed, so the cached public read is stale.
        await invalidatePublicInvitation(result.slug);
        revalidatePath(`/invite/${result.slug}`);
      }
      return {
        kind: "published",
        publicUrl: result.slug === "" ? "" : `/invite/${result.slug}`,
      };
    }
    case "invalid":
      // Readiness passed on the stored draft, so an invalid publish means the
      // stored row moved between the two reads.
      return { kind: "stale", readiness: null };
    case "stale":
      return { kind: "stale", readiness };
    case "forbidden":
      return { kind: "forbidden" };
    case "entitlement-required":
      return {
        kind: "entitlement-required",
        checkoutUrl: `/checkout?template=${encodeURIComponent(input.templateId)}`,
      };
    case "provider-unavailable":
    default:
      return { kind: "unavailable" };
  }
}
