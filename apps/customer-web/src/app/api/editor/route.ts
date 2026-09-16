import { NextResponse } from "next/server";
import {
  editorSaveCommandSchema,
  editorPublishCommandSchema,
  type EditorActionResult,
} from "../../../lib/editor/contract";
import {
  loadEditorForSession,
  resolveEditorSession,
  saveEditorForSession,
  type EditorSessionResolution,
} from "../../../lib/editor/server";
import { publishInvitationAction } from "../../../lib/editor/publish-action";
import { getEditorTemplateId } from "../../../lib/editor/stub-transport";

/**
 * Invitation editor API.
 *
 * The session is the only source of the invitation being edited:
 * `resolveEditorSession` derives the tenant and the invitation from the
 * authenticated membership, so the request body can never name another tenant's
 * row. The body supplies draft content and the version it was based on, and both
 * are validated before use.
 *
 * Responses reuse the editor contract's action union, so the client's existing
 * state machine handles them without a translation layer.
 */

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function unavailable(): NextResponse {
  return json({ kind: "provider-unavailable" }, 503);
}

function forbidden(): NextResponse {
  return json({ kind: "forbidden" }, 403);
}

/**
 * Resolves the session, mapping infrastructure failure onto the same
 * unavailable state the client already understands.
 */
async function sessionFor(
  request: Request,
): Promise<EditorSessionResolution | "unavailable"> {
  // The query parameter only seeds a *first* visit; an existing invitation always
  // wins, so this cannot re-bind content the couple has already written. It is
  // resolved through the same validator the page uses, so a missing or unknown
  // value falls back to the default design instead of an unusable id.
  const templateId = getEditorTemplateId(
    new URL(request.url).searchParams.get("template") ?? undefined,
  );

  try {
    return await resolveEditorSession(templateId);
  } catch {
    return "unavailable";
  }
}

export async function GET(request: Request) {
  const session = await sessionFor(request);
  if (session === "unavailable") return unavailable();
  if (session.kind === "forbidden") return forbidden();
  // An unknown or retired design: there is no invitation to edit, and the action
  // is to choose one from the catalog.
  if (session.kind === "template-unavailable") return forbidden();

  const loaded = await loadEditorForSession(session);
  if (loaded.kind === "forbidden") return forbidden();
  if (loaded.kind === "unavailable") return unavailable();

  return json({
    kind: "ok",
    document: loaded.document,
    template: loaded.template,
    initialSaveState: "saved",
    initialUploadState: null,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ kind: "invalid" }, 400);
  }

  // Publishing and saving share the endpoint because they are the same document
  // under the same authorization. The discriminator is validated before either
  // branch runs, so an unexpected body cannot reach the wrong use-case.
  const publish = editorPublishCommandSchema.safeParse(body);
  if (publish.success) {
    const outcome = await publishInvitationAction({
      baseVersion: publish.data.baseVersion,
      templateId: publish.data.templateId,
    });
    return json(outcome);
  }

  const parsed = editorSaveCommandSchema.safeParse(body);
  if (!parsed.success) return json({ kind: "invalid", issues: [] }, 400);

  const session = await sessionFor(request);
  if (session === "unavailable") return unavailable();
  if (session.kind === "forbidden") return forbidden();
  if (session.kind === "template-unavailable") return forbidden();

  const result = await saveEditorForSession(session, {
    document: parsed.data.document,
    baseVersion: parsed.data.baseVersion,
  });
  if (result.kind === "forbidden") return forbidden();

  // `invalid` without issues means the body failed a check the client's schema
  // already passed, which can only be a contract mismatch rather than a
  // publication issue the editor knows how to highlight.
  const action: EditorActionResult =
    result.kind === "invalid" ? { kind: "invalid", issues: [] } : result;
  return json(action);
}
