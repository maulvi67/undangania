import type { Metadata } from "next";
import { EditorRouteView } from "../../components/editor/editor-shell";
import {
  getEditorInvitationId,
  getEditorTemplateId,
  loadEditor as loadEditorFixture,
} from "../../lib/editor/stub-transport";
import {
  isEditorSectionId,
  parseEditorFixture,
  type EditorLoadResult,
  type EditorSectionId,
} from "../../lib/editor/contract";
import {
  loadEditorForSession,
  resolveEditorSession,
} from "../../lib/editor/server";
import { getAuthenticatedRequest } from "../../lib/auth/server";
import "../editor.css";

export const metadata: Metadata = {
  title: "Editor undangan — Wedding System",
  description:
    "Isi dan periksa undangan pernikahan Anda melalui editor terpandu.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type EditorPageProps = {
  searchParams: Promise<{
    fixture?: string | string[];
    invitation?: string | string[];
    template?: string | string[];
    section?: string | string[];
  }>;
};

function parseSection(value: string | string[] | undefined): EditorSectionId {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && isEditorSectionId(candidate) ? candidate : "couple";
}

/**
 * The editor loads real, tenant-scoped persistence.
 *
 * The invitation is resolved from the session, never from the query string. The
 * `?template=` parameter is only consulted when the wedding has no invitation
 * yet, which is what lets a first visit land directly in the editor from the
 * catalog.
 *
 * The fixture transport remains available on a development server so the guided
 * states (stale draft, failed save, rejected upload) stay reachable without
 * provoking them against real data. It is unreachable in production, and it is
 * not consulted when a real invitation exists.
 */
export default async function EditorPage({ searchParams }: EditorPageProps) {
  const params = await searchParams;
  const section = parseSection(params.section);
  const fixture = parseEditorFixture(params.fixture);

  const authenticated = await getAuthenticatedRequest();
  if (
    authenticated === null &&
    process.env.NODE_ENV !== "production" &&
    params.fixture !== undefined
  ) {
    // Fixtures remain available without a session for development and QA. Once a
    // real session exists, the server-authorized invitation always wins.
    const result = await loadEditorFixture(
      fixture,
      getEditorInvitationId(params.invitation),
      getEditorTemplateId(params.template),
    );
    return (
      <EditorRouteView
        result={result}
        fixture={fixture}
        initialSection={section}
      />
    );
  }

  if (authenticated === null) {
    return (
      <EditorRouteView
        result={{ kind: "forbidden" }}
        fixture="normal"
        initialSection={section}
      />
    );
  }

  const session = await resolveEditorSession(
    getEditorTemplateId(params.template),
  );

  // An unknown or retired design is reported as forbidden: the couple cannot
  // edit an invitation that has no renderable template behind it, and the action
  // is to choose a design from the catalog.
  const result: EditorLoadResult =
    session.kind === "forbidden" || session.kind === "template-unavailable"
      ? { kind: "forbidden" }
      : await loadEditorForSession(session).then((loaded) =>
          loaded.kind === "ok"
            ? {
                kind: "ok" as const,
                document: loaded.document,
                template: loaded.template,
                initialSaveState: "saved" as const,
                initialUploadState: null,
              }
            : { kind: "unavailable" as const },
        );

  return (
    <EditorRouteView
      result={result}
      fixture="normal"
      initialSection={section}
    />
  );
}
