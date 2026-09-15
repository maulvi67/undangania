import type { Metadata } from "next";
import { EditorRouteView } from "../../components/editor/editor-shell";
import {
  getEditorInvitationId,
  getEditorTemplateId,
  loadEditor,
} from "../../lib/editor/stub-transport";
import {
  isEditorSectionId,
  parseEditorFixture,
  type EditorSectionId,
} from "../../lib/editor/contract";
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

export default async function EditorPage({ searchParams }: EditorPageProps) {
  if (process.env.NODE_ENV === "production") {
    const authenticated = await getAuthenticatedRequest();
    return (
      <EditorRouteView
        result={authenticated === null ? { kind: "forbidden" } : { kind: "unavailable" }}
        fixture="normal"
        initialSection="couple"
      />
    );
  }

  const params = await searchParams;
  const fixture = parseEditorFixture(params.fixture);
  const invitationId = getEditorInvitationId(params.invitation);
  const templateId = getEditorTemplateId(params.template);
  const result = await loadEditor(fixture, invitationId, templateId);

  return (
    <EditorRouteView
      result={result}
      fixture={fixture}
      initialSection={parseSection(params.section)}
    />
  );
}
