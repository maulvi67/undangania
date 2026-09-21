import type { TemplateManifest } from "@wedding/template-engine";
import {
  EDITOR_SECTION_IDS,
  editorActionResultSchema,
  editorDocumentSchema,
  type EditorActionResult,
  type EditorContent,
  type EditorDocument,
  type EditorFixture,
  type EditorLoadResult,
  type EditorMediaState,
  type EditorSaveState,
  type EditorTemplate,
} from "./contract";
import {
  getActiveTemplates,
  getTemplate,
} from "../../components/templates/template-data";

/**
 * ⚠️ SIMULATION ONLY — MVP-UI-008 editor transport. ⚠️
 *
 * This module has no tenant, session, authorization, persistence, signed
 * upload, or provider integration. It exists to build the guided editor before
 * the real invitation API is available. Replace it with a tenant-scoped,
 * resource-authorized repository/API before enabling real customer data.
 */

const SIMULATED_DELAY_MS = 120;
const DEFAULT_INVITATION_ID = "demo-invitation";
const DEFAULT_TEMPLATE_ID = "seruni-klasik";
type SimulationState = {
  documents: Map<string, EditorDocument>;
  staleFixtureSeen: Set<string>;
};

type EditorRuntime = typeof globalThis & {
  __weddingEditorSimulation?: SimulationState;
};

const editorRuntime = globalThis as EditorRuntime;
const simulation =
  editorRuntime.__weddingEditorSimulation ??
  (editorRuntime.__weddingEditorSimulation = {
    documents: new Map<string, EditorDocument>(),
    staleFixtureSeen: new Set<string>(),
  });
const DOCUMENTS = simulation.documents;
const STALE_FIXTURE_SEEN = simulation.staleFixtureSeen;

const DEFAULT_SECTION_CONFIG = EDITOR_SECTION_IDS.filter(
  (section) => !["visibility", "order", "settings"].includes(section),
).map((section) => ({
  id: section,
  type: section === "venue" ? "venue" : section,
  visible: true,
})) as EditorContent["sections"];

const EDITOR_RENDERED_SECTIONS = [
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
] as const;

const DEFAULT_MANIFEST: TemplateManifest = {
  id: DEFAULT_TEMPLATE_ID,
  version: "1",
  contractVersion: 1,
  name: "Seruni",
  category: "Klasik",
  supportedSections: [...EDITOR_RENDERED_SECTIONS],
  requiredSections: ["couple", "events"],
  reorderableSections: ["story", "gallery", "music", "gift", "faq"],
  sectionOrder: [...EDITOR_RENDERED_SECTIONS],
};

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultContent(): EditorContent {
  return {
    couple: {
      partner1Name: "Rani",
      partner2Name: "Bima",
      intro:
        "Dengan penuh syukur, kami mengundang Anda untuk hadir di hari bahagia kami.",
    },
    events: [
      {
        id: "akad",
        eventType: "Akad Nikah",
        title: "Akad Nikah",
        startsAt: "2026-09-12T08:00",
        endsAt: "2026-09-12T10:00",
        timezone: "Asia/Jakarta",
        venueName: "Gedung Contoh",
        address: "Jl. Contoh No. 1, Bandung",
        mapUrl: "https://maps.google.com/?q=Gedung+Contoh",
      },
      {
        id: "resepsi",
        eventType: "Resepsi",
        title: "Resepsi",
        startsAt: "2026-09-12T11:00",
        endsAt: "2026-09-12T14:00",
        timezone: "Asia/Jakarta",
        venueName: "Gedung Contoh",
        address: "Jl. Contoh No. 1, Bandung",
        mapUrl: "https://maps.google.com/?q=Gedung+Contoh",
      },
    ],
    story: {
      title: "Kisah kami",
      body: "Tuliskan cerita singkat tentang perjalanan Anda berdua di sini.",
      visible: false,
    },
    music: {
      enabled: false,
      url: "",
      visible: false,
    },
    gifts: [
      {
        id: "gift-1",
        provider: "Bank Contoh",
        accountName: "Rani & Bima",
        accountValue: "0000000000",
        note: "Terima kasih atas doa dan tanda kasih Anda.",
        visible: false,
      },
    ],
    faqs: [
      {
        id: "faq-1",
        question: "Apakah acara ini terbuka untuk umum?",
        answer:
          "Silakan lihat detail acara dan konfirmasi kehadiran melalui undangan.",
        visible: false,
      },
    ],
    sections: DEFAULT_SECTION_CONFIG,
    media: [],
    galleryAssetIds: [],
    settings: {
      invitationTitle: "Undangan Pernikahan Rani & Bima",
      slug: "rani-bima",
      locale: "id-ID",
      timezone: "Asia/Jakarta",
      theme: {
        palette: "ivory",
        accent: "olive",
        typeMood: "serif",
        ornament: "hairline",
      },
    },
  };
}

export function createEditorDocument(
  invitationId = DEFAULT_INVITATION_ID,
): EditorDocument {
  return editorDocumentSchema.parse({
    invitationId,
    version: 1,
    updatedAt: nowIso(),
    content: defaultContent(),
  });
}

function editorTemplate(templateId: string): EditorTemplate {
  const template =
    getTemplate(templateId) ??
    getTemplate(DEFAULT_TEMPLATE_ID) ??
    getActiveTemplates()[0];
  if (!template) {
    return {
      id: DEFAULT_TEMPLATE_ID,
      version: "1",
      name: "Seruni",
      manifest: DEFAULT_MANIFEST,
    };
  }

  const supportedSections = [
    ...new Set([...template.sections, ...EDITOR_RENDERED_SECTIONS]),
  ];
  return {
    id: template.id,
    version: "1",
    name: template.name,
    manifest: {
      ...DEFAULT_MANIFEST,
      id: template.id,
      name: template.name,
      category: template.category,
      supportedSections,
    },
  };
}

function fixtureDocument(
  fixture: EditorFixture,
  invitationId: string,
): EditorDocument {
  const base = createEditorDocument(invitationId);
  if (fixture !== "missing-data" && fixture !== "invalid-section") return base;

  const content = {
    ...base.content,
    ...(fixture === "missing-data"
      ? {
          couple: { partner1Name: "", partner2Name: "", intro: "" },
          events: [],
          settings: { ...base.content.settings, slug: "" },
        }
      : {
          sections: base.content.sections.map((section) =>
            section.type === "story"
              ? { ...section, type: "story" as const }
              : section,
          ),
        }),
  };
  return editorDocumentSchema.parse({ ...base, content });
}

function initialSaveState(fixture: EditorFixture): EditorSaveState {
  if (fixture === "saving") return "saving";
  if (fixture === "save-failed") return "save-failed";
  if (fixture === "offline") return "offline";
  if (fixture === "stale") return "stale-version";
  if (fixture === "invalid-section" || fixture === "missing-data")
    return "invalid-section";
  if (fixture === "unavailable") return "provider-unavailable";
  if (fixture === "entitlement") return "entitlement-limit-reached";
  if (fixture === "forbidden") return "unauthorized";
  return "saved";
}

function initialUploadState(fixture: EditorFixture): EditorMediaState | null {
  if (fixture === "upload-processing") return "PROCESSING";
  if (fixture === "upload-rejected") return "REJECTED";
  return null;
}

export async function loadEditor(
  fixture: EditorFixture = "normal",
  invitationId = DEFAULT_INVITATION_ID,
  templateId = DEFAULT_TEMPLATE_ID,
): Promise<EditorLoadResult> {
  await delay();
  if (fixture === "forbidden") return { kind: "forbidden" };
  if (fixture === "unavailable") return { kind: "unavailable" };

  const existing = DOCUMENTS.get(invitationId);
  const document = existing ?? fixtureDocument(fixture, invitationId);
  if (!existing) DOCUMENTS.set(invitationId, document);

  return {
    kind: "ok",
    document,
    template: editorTemplate(templateId),
    initialSaveState: initialSaveState(fixture),
    initialUploadState: initialUploadState(fixture),
  };
}

export async function saveEditor(command: {
  fixture: EditorFixture;
  document: EditorDocument;
  baseVersion: number;
}): Promise<EditorActionResult> {
  if (typeof window !== "undefined" && command.fixture === "normal") {
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

  await delay();
  if (command.fixture === "offline") return { kind: "offline" };
  if (command.fixture === "save-failed") return { kind: "save-failed" };
  if (command.fixture === "unavailable")
    return { kind: "provider-unavailable" };
  if (command.fixture === "entitlement")
    return { kind: "entitlement-limit-reached" };
  if (command.fixture === "forbidden") return { kind: "forbidden" };
  if (command.fixture === "invalid-section")
    return { kind: "invalid", issues: [] };

  const parsed = editorDocumentSchema.safeParse(command.document);
  if (!parsed.success) return { kind: "invalid", issues: [] };

  const existing =
    DOCUMENTS.get(command.document.invitationId) ??
    createEditorDocument(command.document.invitationId);
  if (
    existing.version !== command.baseVersion ||
    (command.fixture === "stale" &&
      !STALE_FIXTURE_SEEN.has(command.document.invitationId))
  ) {
    const serverDocument =
      command.fixture === "stale" &&
      !STALE_FIXTURE_SEEN.has(command.document.invitationId)
        ? editorDocumentSchema.parse({
            ...existing,
            version: existing.version + 1,
            updatedAt: nowIso(),
            content: {
              ...existing.content,
              story: {
                ...existing.content.story,
                body: "Versi tersimpan di workspace.",
              },
            },
          })
        : existing;
    if (command.fixture === "stale") {
      STALE_FIXTURE_SEEN.add(command.document.invitationId);
      DOCUMENTS.set(command.document.invitationId, serverDocument);
    }
    return { kind: "stale", serverDocument };
  }

  const saved = editorDocumentSchema.parse({
    ...parsed.data,
    version: existing.version + 1,
    updatedAt: nowIso(),
  });
  DOCUMENTS.set(saved.invitationId, saved);
  return { kind: "saved", document: saved };
}

export function getEditorInvitationId(
  value: string | string[] | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^[a-zA-Z0-9_-]{1,100}$/.test(candidate)
    ? candidate
    : DEFAULT_INVITATION_ID;
}

export function getEditorTemplateId(
  value: string | string[] | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && getTemplate(candidate)?.status === "ACTIVE"
    ? candidate
    : DEFAULT_TEMPLATE_ID;
}
