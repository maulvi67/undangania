import {
  editorActionResultSchema,
  type EditorActionResult,
  type EditorDocument,
  type EditorFixture,
} from "./contract";

/**
 * Client transport for the authenticated editor.
 *
 * Normal editor saves always use the session-authorized API. The fixture branch
 * remains available only for the development states rendered by the fixture page.
 */
export async function saveEditorDocument(command: {
  fixture: EditorFixture;
  document: EditorDocument;
  baseVersion: number;
}): Promise<EditorActionResult> {
  if (command.fixture !== "normal") {
    const { saveEditor: saveEditorFixture } = await import("./stub-transport");
    return saveEditorFixture(command);
  }

  const response = await fetch("/api/editor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      document: command.document,
      baseVersion: command.baseVersion,
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  const parsed = editorActionResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Editor transport returned an invalid response");
  }
  return parsed.data;
}
