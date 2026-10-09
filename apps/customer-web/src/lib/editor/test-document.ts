import {
  EDITOR_SECTION_IDS,
  editorDocumentSchema,
  type EditorContent,
  type EditorDocument,
} from "./contract";

/**
 * Test-only editor document factory.
 *
 * Builds a schema-valid document for unit tests of the real editor modules
 * (draft store, stale merge, media reconciliation, preview contract). No runtime
 * module imports this file; the editor itself always loads the workspace's own
 * persisted draft.
 */

const DEFAULT_INVITATION_ID = "demo-invitation";

const DEFAULT_SECTION_CONFIG = EDITOR_SECTION_IDS.filter(
  (section) => !["visibility", "order", "settings"].includes(section),
).map((section) => ({
  id: section,
  type: section === "venue" ? "venue" : section,
  visible: true,
})) as EditorContent["sections"];

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
    updatedAt: new Date().toISOString(),
    content: defaultContent(),
  });
}
