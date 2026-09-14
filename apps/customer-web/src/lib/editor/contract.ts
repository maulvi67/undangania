import { z } from "zod";
import {
  invitationViewModelSchema,
  type InvitationSectionType,
  type InvitationViewModel,
  type TemplateManifest,
} from "@wedding/template-engine";

/**
 * Customer-web editor contract.
 *
 * This is the validated draft boundary used by the UI and the simulation
 * transport. It deliberately contains structured content, never HTML/CSS/JS
 * supplied by a customer. `toInvitationViewModel` is the only bridge to the
 * renderer-facing canonical Template Engine model.
 */

export const EDITOR_FIXTURES = [
  "normal",
  "saving",
  "save-failed",
  "offline",
  "stale",
  "invalid-section",
  "upload-processing",
  "upload-rejected",
  "missing-data",
  "unavailable",
  "entitlement",
  "forbidden",
] as const;

export type EditorFixture = (typeof EDITOR_FIXTURES)[number];

export function isEditorFixture(value: string): value is EditorFixture {
  return (EDITOR_FIXTURES as readonly string[]).includes(value);
}

export function isEditorSectionId(value: string): value is EditorSectionId {
  return (EDITOR_SECTION_IDS as readonly string[]).includes(value);
}

export const EDITOR_SECTION_IDS = [
  "couple",
  "events",
  "venue",
  "cover",
  "story",
  "gallery",
  "music",
  "gift",
  "faq",
  "visibility",
  "order",
  "settings",
] as const;

export type EditorSectionId = (typeof EDITOR_SECTION_IDS)[number];

export const EDITOR_SECTION_LABELS: Record<EditorSectionId, string> = {
  couple: "Mempelai",
  events: "Acara",
  venue: "Lokasi & peta",
  cover: "Sampul",
  story: "Kisah",
  gallery: "Galeri",
  music: "Musik",
  gift: "Hadiah",
  faq: "FAQ",
  visibility: "Tampilan bagian",
  order: "Urutan bagian",
  settings: "Pengaturan undangan",
};

export const RENDERED_SECTION_TYPES = [
  "hero",
  "couple",
  "events",
  "venue",
  "cover",
  "story",
  "gallery",
  "music",
  "gift",
  "faq",
  "guestbook",
  "rsvp",
  "closing",
] as const satisfies readonly InvitationSectionType[];

export type RenderedSectionType = (typeof RENDERED_SECTION_TYPES)[number];

export const editorSectionConfigSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(RENDERED_SECTION_TYPES),
  visible: z.boolean(),
});

export type EditorSectionConfig = z.infer<typeof editorSectionConfigSchema>;

export const editorEventSchema = z.object({
  id: z.string().min(1).max(100),
  eventType: z.string().max(100),
  title: z.string().max(250),
  startsAt: z.string().max(80),
  endsAt: z.string().max(80).nullable(),
  timezone: z.string().min(1).max(100),
  venueName: z.string().max(250),
  address: z.string().max(1000).nullable(),
  mapUrl: z.string().max(2000).nullable(),
});

export type EditorEvent = z.infer<typeof editorEventSchema>;

export const editorMediaStateSchema = z.enum([
  "PENDING_UPLOAD",
  "UPLOADED",
  "SCANNING",
  "PROCESSING",
  "READY",
  "REJECTED",
  "DELETED",
]);

export type EditorMediaState = z.infer<typeof editorMediaStateSchema>;

export const editorMediaAssetSchema = z.object({
  id: z.string().min(1).max(200),
  filename: z.string().min(1).max(255),
  mediaType: z.enum(["IMAGE", "AUDIO"]),
  mimeType: z.string().min(1).max(100),
  state: editorMediaStateSchema,
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  altText: z.string().max(300).nullable(),
  rejectionReason: z.string().max(500).nullable(),
});

export type EditorMediaAsset = z.infer<typeof editorMediaAssetSchema>;

export const editorGiftItemSchema = z.object({
  id: z.string().min(1).max(100),
  provider: z.string().max(100),
  accountName: z.string().max(150),
  accountValue: z.string().max(150),
  note: z.string().max(500),
  visible: z.boolean(),
});

export type EditorGiftItem = z.infer<typeof editorGiftItemSchema>;

export const editorFaqItemSchema = z.object({
  id: z.string().min(1).max(100),
  question: z.string().max(250),
  answer: z.string().max(2000),
  visible: z.boolean(),
});

export type EditorFaqItem = z.infer<typeof editorFaqItemSchema>;

export const editorContentSchema = z.object({
  couple: z.object({
    partner1Name: z.string().max(120),
    partner2Name: z.string().max(120),
    intro: z.string().max(3000),
  }),
  events: z.array(editorEventSchema).max(50),
  story: z.object({
    title: z.string().max(250),
    body: z.string().max(10000),
    visible: z.boolean(),
  }),
  music: z.object({
    enabled: z.boolean(),
    url: z.string().max(2000),
    visible: z.boolean(),
  }),
  gifts: z.array(editorGiftItemSchema).max(20),
  faqs: z.array(editorFaqItemSchema).max(30),
  sections: z.array(editorSectionConfigSchema).min(1).max(30),
  media: z.array(editorMediaAssetSchema).max(100),
  settings: z.object({
    invitationTitle: z.string().max(150),
    slug: z.string().max(100),
    locale: z.enum(["id-ID", "en-GB"]),
    timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]),
    theme: z.object({
      palette: z.enum(["ivory", "paper", "blush"]),
      accent: z.enum(["olive", "clay", "gold"]),
      typeMood: z.enum(["serif", "sans"]),
      ornament: z.enum(["hairline", "frame", "none"]),
    }),
  }),
});

export type EditorContent = z.infer<typeof editorContentSchema>;

export const editorDocumentSchema = z.object({
  invitationId: z.string().min(1).max(100),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  content: editorContentSchema,
});

export type EditorDocument = z.infer<typeof editorDocumentSchema>;

export const editorTemplateSchema = z.object({
  id: z.string().min(1).max(100),
  version: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  manifest: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    contractVersion: z.number().int().positive(),
    name: z.string().min(1),
    category: z.string().min(1),
    supportedSections: z.array(z.string().min(1)).min(1),
    requiredSections: z.array(z.string().min(1)).optional(),
    reorderableSections: z.array(z.string().min(1)).optional(),
    sectionOrder: z.array(z.string().min(1)).optional(),
  }),
});

export type EditorTemplate = Omit<
  z.infer<typeof editorTemplateSchema>,
  "manifest"
> & {
  manifest: TemplateManifest;
};

export const editorSaveCommandSchema = z.object({
  fixture: z.enum(EDITOR_FIXTURES),
  document: editorDocumentSchema,
  baseVersion: z.number().int().nonnegative(),
});

export type EditorSaveCommand = z.infer<typeof editorSaveCommandSchema>;

const publicationIssueSchema = z.object({
  code: z.enum([
    "COUPLE_REQUIRED",
    "EVENT_REQUIRED",
    "EVENT_INVALID",
    "VENUE_REQUIRED",
    "EVENT_FIELD_TOO_LONG",
    "MAP_INVALID",
    "SLUG_INVALID",
    "SECTION_REQUIRED",
    "MEDIA_NOT_READY",
  ]),
  section: z.enum(EDITOR_SECTION_IDS),
  field: z.string().optional(),
  message: z.string(),
});

export const editorActionResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved"), document: editorDocumentSchema }),
  z.object({ kind: z.literal("stale"), serverDocument: editorDocumentSchema }),
  z.object({
    kind: z.literal("invalid"),
    issues: z.array(publicationIssueSchema),
  }),
  z.object({ kind: z.literal("save-failed") }),
  z.object({ kind: z.literal("offline") }),
  z.object({ kind: z.literal("provider-unavailable") }),
  z.object({ kind: z.literal("entitlement-limit-reached") }),
  z.object({ kind: z.literal("forbidden") }),
]);

export type EditorSaveState =
  | "loading"
  | "saved"
  | "dirty"
  | "saving"
  | "save-failed"
  | "offline"
  | "stale-version"
  | "invalid-section"
  | "upload-processing"
  | "upload-rejected"
  | "provider-unavailable"
  | "entitlement-limit-reached"
  | "locked"
  | "unauthorized";

export type PublicationIssue = {
  code:
    | "COUPLE_REQUIRED"
    | "EVENT_REQUIRED"
    | "EVENT_INVALID"
    | "VENUE_REQUIRED"
    | "EVENT_FIELD_TOO_LONG"
    | "MAP_INVALID"
    | "SLUG_INVALID"
    | "SECTION_REQUIRED"
    | "MEDIA_NOT_READY";
  section: EditorSectionId;
  field?: string | undefined;
  message: string;
};

export type PublicationReadiness = {
  ready: boolean;
  issues: ReadonlyArray<PublicationIssue>;
};

export type EditorActionResult =
  | { kind: "saved"; document: EditorDocument }
  | { kind: "stale"; serverDocument: EditorDocument }
  | { kind: "invalid"; issues: ReadonlyArray<PublicationIssue> }
  | { kind: "save-failed" }
  | { kind: "offline" }
  | { kind: "provider-unavailable" }
  | { kind: "entitlement-limit-reached" }
  | { kind: "forbidden" };

export type EditorLoadResult =
  | {
      kind: "ok";
      document: EditorDocument;
      template: EditorTemplate;
      initialSaveState: EditorSaveState;
      initialUploadState: EditorMediaState | null;
    }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

export type PreviewMessage =
  | {
      type: "EDITOR_PREVIEW_INIT";
      protocolVersion: 1;
      requestId: string;
      templateId: string;
      templateVersion: string;
      model: InvitationViewModel;
    }
  | {
      type: "EDITOR_PREVIEW_UPDATE";
      protocolVersion: 1;
      requestId: string;
      templateId: string;
      templateVersion: string;
      changedSections: ReadonlyArray<string>;
      model: InvitationViewModel;
    }
  | {
      type: "EDITOR_PREVIEW_REQUEST_REFRESH";
      protocolVersion: 1;
      requestId: string;
    }
  | { type: "PREVIEW_READY"; protocolVersion: 1; requestId: string }
  | { type: "PREVIEW_RENDERED"; protocolVersion: 1; requestId: string }
  | {
      type: "PREVIEW_ERROR";
      protocolVersion: 1;
      requestId: string;
      message: string;
    };

function sectionFor(
  content: EditorContent,
  type: RenderedSectionType,
): EditorSectionConfig {
  const found = content.sections.find((section) => section.type === type);
  return found ?? { id: type, type, visible: true };
}

function previewText(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function sectionPayload(
  content: EditorContent,
  type: RenderedSectionType,
): Record<string, unknown> {
  if (type === "couple")
    return { title: "Mempelai", body: content.couple.intro };
  if (type === "events") return { title: "Rangkaian acara" };
  if (type === "story")
    return { title: content.story.title, body: content.story.body };
  if (type === "music")
    return { url: content.music.url, enabled: content.music.enabled };
  if (type === "gift") return { items: content.gifts };
  if (type === "faq") return { items: content.faqs };
  if (type === "gallery" || type === "cover") {
    return {
      assetIds: content.media
        .filter(
          (asset) => asset.state === "READY" && asset.mediaType === "IMAGE",
        )
        .map((asset) => asset.id),
    };
  }
  return {};
}

export function toInvitationViewModel(
  content: EditorContent,
): InvitationViewModel {
  const partner1Name = previewText(content.couple.partner1Name.trim(), 120);
  const partner2Name = previewText(content.couple.partner2Name.trim(), 120);
  const displayNames =
    partner1Name || partner2Name
      ? previewText(`${partner1Name} & ${partner2Name}`.trim(), 250)
      : "Undangan Pernikahan";

  return invitationViewModelSchema.parse({
    schemaVersion: 1,
    locale: content.settings.locale,
    timezone: content.settings.timezone,
    couple: {
      displayNames,
      partner1Name,
      partner2Name,
    },
    events: content.events
      .filter((event) => event.startsAt.trim() !== "")
      .map((event) => ({
        id: event.id,
        title: previewText(event.title || event.eventType || "Acara", 250),
        eventType: previewText(event.eventType, 100),
        startsAt: previewText(event.startsAt, 80),
        ...(event.endsAt !== null
          ? { endsAt: previewText(event.endsAt, 80) }
          : {}),
        timezone: previewText(event.timezone, 100),
        venueName: previewText(event.venueName, 250),
        ...(event.address !== null
          ? { address: previewText(event.address, 1000) }
          : {}),
        ...(event.mapUrl !== null
          ? { mapUrl: previewText(event.mapUrl, 2000) }
          : {}),
      })),
    sections: RENDERED_SECTION_TYPES.map((type) => {
      const section = sectionFor(content, type);
      return {
        id: section.id,
        type,
        visible: section.visible,
        payload: sectionPayload(content, type),
      };
    }),
  });
}

function validLocalDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isValidMapUrl(value: string): boolean {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function sectionVisible(
  content: EditorContent,
  type: RenderedSectionType,
): boolean {
  return sectionFor(content, type).visible;
}

export function publicationReadiness(
  content: EditorContent,
  manifest: TemplateManifest,
): PublicationReadiness {
  const issues: PublicationIssue[] = [];
  const coupleNames =
    content.couple.partner1Name.trim() && content.couple.partner2Name.trim();
  if (!coupleNames) {
    issues.push({
      code: "COUPLE_REQUIRED",
      section: "couple",
      field: "partner1Name",
      message: "Lengkapi nama kedua mempelai.",
    });
  }

  if (content.events.length === 0) {
    issues.push({
      code: "EVENT_REQUIRED",
      section: "events",
      message: "Tambahkan setidaknya satu acara.",
    });
  }

  for (const event of content.events) {
    if (!event.title.trim() || !validLocalDateTime(event.startsAt)) {
      issues.push({
        code: "EVENT_INVALID",
        section: "events",
        field: event.id,
        message: "Lengkapi nama dan waktu acara dengan format yang benar.",
      });
    }
    if (!event.venueName.trim()) {
      issues.push({
        code: "VENUE_REQUIRED",
        section: "venue",
        field: event.id,
        message: "Tambahkan nama venue untuk setiap acara.",
      });
    }
    if (
      event.venueName.length > 250 ||
      (event.address !== null && event.address.length > 1000)
    ) {
      issues.push({
        code: "EVENT_FIELD_TOO_LONG",
        section: "venue",
        field: event.id,
        message:
          "Nama tempat maksimal 250 karakter dan alamat maksimal 1.000 karakter.",
      });
    }
    if (!isValidMapUrl(event.mapUrl ?? "")) {
      issues.push({
        code: "MAP_INVALID",
        section: "venue",
        field: event.id,
        message: "Tautan peta harus berupa alamat web yang valid.",
      });
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(content.settings.slug.trim())) {
    issues.push({
      code: "SLUG_INVALID",
      section: "settings",
      field: "slug",
      message:
        "Gunakan huruf kecil, angka, dan tanda hubung untuk slug undangan.",
    });
  }

  for (const required of manifest.requiredSections ?? ["couple", "events"]) {
    if (!sectionVisible(content, required as RenderedSectionType)) {
      issues.push({
        code: "SECTION_REQUIRED",
        section: required === "events" ? "events" : "couple",
        message: "Bagian wajib tidak dapat disembunyikan sebelum publikasi.",
      });
    }
  }

  const visibleMedia = content.media.filter(
    (asset) => asset.state === "REJECTED" && asset.mediaType === "IMAGE",
  );
  if (
    visibleMedia.length > 0 &&
    (sectionVisible(content, "cover") || sectionVisible(content, "gallery"))
  ) {
    issues.push({
      code: "MEDIA_NOT_READY",
      section: "gallery",
      message: "Selesaikan atau hapus media yang ditolak sebelum publikasi.",
    });
  }

  return { ready: issues.length === 0, issues };
}

export function sectionStatus(
  content: EditorContent,
  section: EditorSectionId,
  manifest: TemplateManifest,
): "complete" | "incomplete" | "optional" | "attention" | "locked" {
  const readiness = publicationReadiness(content, manifest);
  if (section === "visibility" || section === "order") return "complete";
  if (section === "settings") {
    return readiness.issues.some((issue) => issue.section === "settings")
      ? "attention"
      : "complete";
  }
  if (
    !manifest.supportedSections.includes(section) &&
    section !== "venue" &&
    section !== "cover"
  )
    return "locked";
  const hasIssue = readiness.issues.some((issue) => issue.section === section);
  if (hasIssue) return "attention";
  if (section === "couple")
    return content.couple.partner1Name.trim() &&
      content.couple.partner2Name.trim()
      ? "complete"
      : "incomplete";
  if (section === "events")
    return content.events.length > 0 &&
      content.events.every(
        (event) => event.title.trim() && validLocalDateTime(event.startsAt),
      )
      ? "complete"
      : "incomplete";
  if (section === "venue")
    return content.events.length > 0 &&
      content.events.every((event) => event.venueName.trim())
      ? "complete"
      : "incomplete";
  if (section === "cover" || section === "gallery")
    return content.media.some(
      (asset) => asset.state === "READY" && asset.mediaType === "IMAGE",
    )
      ? "complete"
      : "optional";
  if (section === "story")
    return content.story.body.trim() ? "complete" : "optional";
  if (section === "music")
    return content.music.enabled && content.music.url.trim()
      ? "complete"
      : "optional";
  if (section === "gift")
    return content.gifts.some(
      (gift) => gift.visible && gift.accountValue.trim(),
    )
      ? "complete"
      : "optional";
  if (section === "faq")
    return content.faqs.some(
      (item) => item.visible && item.question.trim() && item.answer.trim(),
    )
      ? "complete"
      : "optional";
  return "optional";
}

export function parseEditorFixture(
  value: string | string[] | undefined,
): EditorFixture {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate !== undefined && isEditorFixture(candidate)
    ? candidate
    : "normal";
}

export function statusLabel(state: EditorSaveState): string {
  switch (state) {
    case "loading":
      return "Memuat draf…";
    case "saved":
      return "Tersimpan";
    case "dirty":
      return "Perubahan belum disimpan";
    case "saving":
      return "Menyimpan…";
    case "save-failed":
      return "Gagal menyimpan";
    case "offline":
      return "Tidak tersambung";
    case "stale-version":
      return "Draf berubah di tempat lain";
    case "invalid-section":
      return "Perlu diperiksa";
    case "upload-processing":
      return "Media sedang diproses";
    case "upload-rejected":
      return "Media ditolak";
    case "provider-unavailable":
      return "Layanan tidak tersedia";
    case "entitlement-limit-reached":
      return "Batas paket tercapai";
    case "locked":
      return "Hanya baca";
    case "unauthorized":
      return "Anda belum masuk";
  }
}
