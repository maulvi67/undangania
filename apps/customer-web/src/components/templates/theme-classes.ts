import type { TemplateRecord } from "./template-contract";

/** Allowlisted theme token names → composable CSS classes (no raw CSS from data). */
export function themeClasses(template: TemplateRecord): string {
  const { theme } = template;
  return [
    "tpl-theme",
    `tpl-theme--palette-${theme.palette}`,
    `tpl-theme--accent-${theme.accent}`,
    `tpl-theme--type-${theme.typeMood}`,
    `tpl-theme--ornament-${theme.ornament}`,
  ].join(" ");
}
