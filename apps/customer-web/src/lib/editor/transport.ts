import {
  editorActionResultSchema,
  type EditorActionResult,
  type EditorDocument,
} from "./contract";

/**
 * Client transport for the authenticated editor.
 *
 * Every save goes through the session-authorized API: the invitation is derived
 * from the authenticated workspace server-side, so the body can only supply
 * draft content and the version it was based on.
 */
export async function saveEditorDocument(command: {
  document: EditorDocument;
  baseVersion: number;
}): Promise<EditorActionResult> {
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
