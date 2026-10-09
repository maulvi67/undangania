import {
  DEFAULT_TEMPLATE_ID,
  getTemplate,
} from "../../components/templates/template-data";

/**
 * Resolves the `?template=` seed for a first editor visit.
 *
 * The value only seeds a *first* visit: `resolveEditorSession` lets an existing
 * invitation win, so this can never re-bind content the couple has already
 * written. An unknown or retired design falls back to the catalogue default
 * rather than opening an editor with no renderable template behind it.
 */
export function editorTemplateIdFromSearch(
  value: string | string[] | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate !== undefined &&
    getTemplate(candidate)?.status === "ACTIVE"
    ? candidate
    : DEFAULT_TEMPLATE_ID;
}
