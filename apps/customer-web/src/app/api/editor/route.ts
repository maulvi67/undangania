import { NextResponse } from "next/server";
import {
  editorSaveCommandSchema,
  isEditorFixture,
  type EditorActionResult,
  type EditorFixture,
} from "../../../lib/editor/contract";
import {
  getEditorInvitationId,
  getEditorTemplateId,
} from "../../../lib/editor/stub-transport";
import { loadEditor, saveEditor } from "../../../lib/editor/stub-transport";

/**
 * ⚠️ SIMULATION ONLY — MVP-UI-008 browser-audit transport. ⚠️
 *
 * This route deliberately has no session, tenant, resource authorization,
 * database persistence, signed upload, or provider integration. It exists so
 * browser refreshes exercise the same process-level simulation store as the
 * editor page. Replace it with the authorized invitation application API
 * before using customer data.
 */

const API_FIXTURE_HEADER = "x-editor-fixture";

function fixtureFromRequest(request: Request): EditorFixture {
  const fixture = request.headers.get(API_FIXTURE_HEADER);
  return fixture && isEditorFixture(fixture) ? fixture : "normal";
}

function productionGuardResponse(): NextResponse {
  return NextResponse.json(
    {
      kind: "unavailable",
      message: "Editor production API belum tersedia.",
    },
    { status: 503 },
  );
}

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return productionGuardResponse();
  }

  const url = new URL(request.url);
  const invitation = getEditorInvitationId(
    url.searchParams.get("invitation") ?? undefined,
  );
  const template = getEditorTemplateId(
    url.searchParams.get("template") ?? undefined,
  );
  const result = await loadEditor(
    fixtureFromRequest(request),
    invitation,
    template,
  );
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return productionGuardResponse();
  }

  const parsed = editorSaveCommandSchema.safeParse(await requestBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { kind: "invalid", issues: [] satisfies ReadonlyArray<never> },
      { status: 400 },
    );
  }

  const command = {
    ...parsed.data,
    fixture: fixtureFromRequest(request),
  };
  const result: EditorActionResult = await saveEditor(command);
  return NextResponse.json(result);
}
