import { Input, Select } from "@wedding/ui";
import type { EditorContent } from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

const LOCALES = [
  { value: "id-ID", label: "Bahasa Indonesia" },
  { value: "en-GB", label: "English" },
] as const;

const TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
] as const;

const PALETTES = [
  { value: "ivory", label: "Ivory" },
  { value: "paper", label: "Paper" },
  { value: "blush", label: "Blush" },
] as const;

const ACCENTS = [
  { value: "olive", label: "Olive" },
  { value: "clay", label: "Clay" },
  { value: "gold", label: "Gold" },
] as const;

const TYPE_MOODS = [
  { value: "serif", label: "Serif editorial" },
  { value: "sans", label: "Sans modern" },
] as const;

const ORNAMENTS = [
  { value: "hairline", label: "Garis halus" },
  { value: "frame", label: "Frame" },
  { value: "none", label: "Tanpa ornamen" },
] as const;

export function SectionSettings({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  const settings = content.settings;
  const slugInvalid = !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(settings.slug.trim());
  return (
    <div className="ed-section-content">
      <Input
        id="editor-invitation-title"
        label="Judul undangan"
        hint="Judul ini dapat membantu Anda mengenali undangan di workspace."
        value={settings.invitationTitle}
        onChange={(event) =>
          onChange({
            settings: {
              ...settings,
              invitationTitle: event.currentTarget.value,
            },
          })
        }
      />
      <Input
        id="editor-invitation-slug"
        label="Alamat undangan"
        required
        hint="Gunakan huruf kecil, angka, dan tanda hubung."
        value={settings.slug}
        {...(slugInvalid
          ? { error: "Gunakan huruf kecil, angka, dan tanda hubung." }
          : {})}
        onChange={(event) =>
          onChange({
            settings: { ...settings, slug: event.currentTarget.value },
          })
        }
      />
      <div className="ed-form-grid ed-form-grid--two">
        <Select
          id="editor-locale"
          label="Bahasa undangan"
          options={LOCALES}
          value={settings.locale}
          onChange={(event) =>
            onChange({
              settings: {
                ...settings,
                locale: event.currentTarget.value as "id-ID" | "en-GB",
              },
            })
          }
        />
        <Select
          id="editor-timezone"
          label="Zona waktu utama"
          options={TIMEZONES}
          value={settings.timezone}
          onChange={(event) =>
            onChange({
              settings: {
                ...settings,
                timezone: event.currentTarget
                  .value as EditorContent["settings"]["timezone"],
              },
            })
          }
        />
        <Select
          id="editor-palette"
          label="Palet tampilan"
          options={PALETTES}
          value={settings.theme.palette}
          onChange={(event) =>
            onChange({
              settings: {
                ...settings,
                theme: {
                  ...settings.theme,
                  palette: event.currentTarget
                    .value as EditorContent["settings"]["theme"]["palette"],
                },
              },
            })
          }
        />
        <Select
          id="editor-accent"
          label="Aksen tampilan"
          options={ACCENTS}
          value={settings.theme.accent}
          onChange={(event) =>
            onChange({
              settings: {
                ...settings,
                theme: {
                  ...settings.theme,
                  accent: event.currentTarget
                    .value as EditorContent["settings"]["theme"]["accent"],
                },
              },
            })
          }
        />
        <Select
          id="editor-type-mood"
          label="Karakter tipografi"
          options={TYPE_MOODS}
          value={settings.theme.typeMood}
          onChange={(event) =>
            onChange({
              settings: {
                ...settings,
                theme: {
                  ...settings.theme,
                  typeMood: event.currentTarget
                    .value as EditorContent["settings"]["theme"]["typeMood"],
                },
              },
            })
          }
        />
        <Select
          id="editor-ornament"
          label="Ornamen"
          options={ORNAMENTS}
          value={settings.theme.ornament}
          onChange={(event) =>
            onChange({
              settings: {
                ...settings,
                theme: {
                  ...settings.theme,
                  ornament: event.currentTarget
                    .value as EditorContent["settings"]["theme"]["ornament"],
                },
              },
            })
          }
        />
      </div>
    </div>
  );
}
