import type { EditorContent, EditorDocument } from "./contract";

export type EditorContentKey = keyof EditorContent;

export type StaleConflict = {
  key: EditorContentKey;
  label: string;
};

export type StaleMergeResult = {
  merged: EditorDocument;
  conflicts: ReadonlyArray<StaleConflict>;
};

const CONTENT_KEYS: ReadonlyArray<{ key: EditorContentKey; label: string }> = [
  { key: "couple", label: "Mempelai" },
  { key: "events", label: "Acara" },
  { key: "story", label: "Kisah" },
  { key: "music", label: "Musik" },
  { key: "gifts", label: "Hadiah" },
  { key: "faqs", label: "FAQ" },
  { key: "sections", label: "Tampilan dan urutan bagian" },
  { key: "media", label: "Media" },
  { key: "settings", label: "Pengaturan undangan" },
];

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Three-way merge at section boundaries. The last acknowledged document is
 * the base; non-overlapping local changes win, while simultaneous changes are
 * surfaced for explicit user choice. Gift values are never rendered by this
 * module, so callers can mask them in the conflict UI.
 */
export function mergeStaleDocument(
  local: EditorDocument,
  server: EditorDocument,
  base: EditorDocument,
): StaleMergeResult {
  const mergedContent: EditorContent = { ...server.content };
  const conflicts: StaleConflict[] = [];

  for (const item of CONTENT_KEYS) {
    const localValue = local.content[item.key];
    const serverValue = server.content[item.key];
    const baseValue = base.content[item.key];
    const localChanged = !sameValue(localValue, baseValue);
    const serverChanged = !sameValue(serverValue, baseValue);

    if (localChanged && serverChanged && !sameValue(localValue, serverValue)) {
      conflicts.push({ key: item.key, label: item.label });
      continue;
    }
    if (localChanged && !serverChanged) {
      Object.assign(mergedContent, { [item.key]: localValue });
    }
  }

  return {
    merged: {
      ...server,
      content: mergedContent,
    },
    conflicts,
  };
}

export function keepLocalContent(
  merged: EditorDocument,
  local: EditorDocument,
  key: EditorContentKey,
): EditorDocument {
  const content = { ...merged.content };
  Object.assign(content, { [key]: local.content[key] });
  return { ...merged, content };
}
