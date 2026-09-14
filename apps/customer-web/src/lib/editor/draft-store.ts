import { editorDocumentSchema, type EditorDocument } from "./contract";

export const EDITOR_DRAFT_STORAGE_PREFIX = "wedding-editor-draft-v1:";

export type StoredEditorDraft = {
  document: EditorDocument;
  baseVersion: number;
  savedAt: number;
};

export interface EditorDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function browserEditorStorage(): EditorDraftStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const probe = "__wedding-editor-storage-probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function keyFor(invitationId: string): string {
  return `${EDITOR_DRAFT_STORAGE_PREFIX}${invitationId}`;
}

export function parseStoredEditorDraft(
  raw: string | null,
): StoredEditorDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    const document = editorDocumentSchema.safeParse(record.document);
    if (!document.success) return null;
    if (
      typeof record.baseVersion !== "number" ||
      !Number.isInteger(record.baseVersion) ||
      record.baseVersion < 0
    )
      return null;
    if (typeof record.savedAt !== "number" || !Number.isFinite(record.savedAt))
      return null;
    return {
      document: document.data,
      baseVersion: record.baseVersion,
      savedAt: record.savedAt,
    };
  } catch {
    return null;
  }
}

export function loadStoredEditorDraft(
  invitationId: string,
  storage: EditorDraftStorage | null = browserEditorStorage(),
): StoredEditorDraft | null {
  if (!storage || invitationId.trim() === "") return null;
  try {
    return parseStoredEditorDraft(storage.getItem(keyFor(invitationId)));
  } catch {
    return null;
  }
}

export function saveStoredEditorDraft(
  invitationId: string,
  draft: StoredEditorDraft,
  storage: EditorDraftStorage | null = browserEditorStorage(),
): void {
  if (!storage || invitationId.trim() === "") return;
  try {
    storage.setItem(keyFor(invitationId), JSON.stringify(draft));
  } catch {
    // Local recovery is best effort and must never block editing.
  }
}

export function clearStoredEditorDraft(
  invitationId: string,
  storage: EditorDraftStorage | null = browserEditorStorage(),
): void {
  if (!storage || invitationId.trim() === "") return;
  try {
    storage.removeItem(keyFor(invitationId));
  } catch {
    // Deliberately ignored: storage can be unavailable in private browsing.
  }
}
