import {
  invitationViewModelSchema,
  type InvitationViewModel,
} from "@wedding/template-engine";

export const PUBLIC_INVITATION_FIXTURES = [
  "normal",
  "long-content",
  "missing-optional",
  "three-events",
  "large-gallery",
] as const;

export type PublicInvitationFixture = (typeof PUBLIC_INVITATION_FIXTURES)[number];

export type PublicationSnapshot = Readonly<{
  slug: string;
  templateId: string;
  templateVersion: string;
  contractVersion: number;
  model: InvitationViewModel;
}>;

type RawSection = {
  id: string;
  type: string;
  visible: boolean;
  payload: Record<string, unknown>;
};

type RawEvent = {
  id: string;
  title: string;
  eventType: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  venueName: string;
  address?: string;
  mapUrl?: string;
};

const normalEvents: RawEvent[] = [
  {
    id: "akad",
    title: "Akad Nikah",
    eventType: "Akad Nikah",
    startsAt: "2026-09-12T08:00",
    endsAt: "2026-09-12T10:00",
    timezone: "Asia/Jakarta",
    venueName: "Masjid Agung Contoh",
    address: "Jl. Merdeka No. 12, Bandung",
    mapUrl: "https://maps.google.com/?q=Masjid+Agung+Contoh+Bandung",
  },
  {
    id: "resepsi",
    title: "Resepsi",
    eventType: "Resepsi",
    startsAt: "2026-09-12T11:00",
    endsAt: "2026-09-12T14:00",
    timezone: "Asia/Jakarta",
    venueName: "Gedung Cendana",
    address: "Jl. Dago Selatan No. 8, Bandung",
    mapUrl: "https://maps.google.com/?q=Gedung+Cendana+Bandung",
  },
];

const extraEvent: RawEvent = {
  id: "pengajian",
  title: "Pengajian keluarga",
  eventType: "Pengajian",
  startsAt: "2026-09-11T19:00",
  endsAt: "2026-09-11T21:00",
  timezone: "Asia/Jakarta",
  venueName: "Rumah keluarga Rahman",
  address: "Jl. Anggrek Raya No. 4, Bandung",
  mapUrl: "https://maps.google.com/?q=Rumah+keluarga+Rahman+Bandung",
};

const normalSections: RawSection[] = [
  {
    id: "hero",
    type: "hero",
    visible: true,
    payload: { title: "Undangan Pernikahan" },
  },
  {
    id: "couple",
    type: "couple",
    visible: true,
    payload: {
      title: "Tentang kami",
      body:
        "Dengan memohon rahmat dan ridha Tuhan Yang Maha Esa, kami mengundang Anda untuk hadir dan berbagi kebahagiaan pada hari pernikahan kami.",
    },
  },
  {
    id: "events",
    type: "events",
    visible: true,
    payload: { title: "Rangkaian acara" },
  },
  {
    id: "venue",
    type: "venue",
    visible: true,
    payload: { title: "Lokasi acara" },
  },
  {
    id: "story",
    type: "story",
    visible: true,
    payload: {
      title: "Kisah kami",
      body:
        "Berawal dari pertemuan sederhana, kami belajar bahwa rumah dapat ditemukan dalam percakapan yang hangat, doa yang panjang, dan langkah yang dipilih bersama.",
    },
  },
  {
    id: "gallery",
    type: "gallery",
    visible: true,
    payload: {
      title: "Galeri",
      assetIds: [
        "rani-bima-gallery-01",
        "rani-bima-gallery-02",
        "rani-bima-gallery-03",
        "rani-bima-gallery-04",
        "rani-bima-gallery-05",
        "rani-bima-gallery-06",
      ],
    },
  },
  {
    id: "music",
    type: "music",
    visible: false,
    payload: {},
  },
  {
    id: "gift",
    type: "gift",
    visible: true,
    payload: {
      title: "Tanda kasih",
      items: [
        {
          provider: "Bank Contoh",
          accountName: "Rani & Bima",
          accountValue: "0000 0000 0000",
          note: "Terima kasih atas doa dan tanda kasih Anda.",
        },
      ],
    },
  },
  {
    id: "faq",
    type: "faq",
    visible: true,
    payload: {
      title: "Pertanyaan umum",
      items: [
        {
          question: "Apakah acara terbuka untuk umum?",
          answer:
            "Acara ditujukan untuk keluarga dan sahabat yang menerima undangan ini. Mohon konfirmasi melalui bagian RSVP.",
        },
        {
          question: "Apakah tersedia tempat parkir?",
          answer: "Area parkir tersedia di sekitar gedung acara.",
        },
      ],
    },
  },
  {
    id: "guestbook",
    type: "guestbook",
    visible: true,
    payload: {
      title: "Buku tamu",
      items: [
        {
          name: "Keluarga besar",
          text: "Semoga menjadi keluarga yang sakinah, mawaddah, warahmah.",
        },
      ],
    },
  },
  {
    id: "rsvp",
    type: "rsvp",
    visible: true,
    payload: { title: "Konfirmasi kehadiran" },
  },
  {
    id: "closing",
    type: "closing",
    visible: true,
    payload: {
      title: "Sampai jumpa",
      body: "Merupakan suatu kehormatan bagi kami apabila Anda berkenan hadir.",
    },
  },
];

const baseModelInput = {
  schemaVersion: 1 as const,
  locale: "id-ID",
  timezone: "Asia/Jakarta",
  couple: {
    displayNames: "Rani & Bima",
    partner1Name: "Rani",
    partner2Name: "Bima",
  },
  events: normalEvents,
  sections: normalSections,
};

function createModel(input: {
  couple?: Partial<typeof baseModelInput.couple>;
  events?: RawEvent[];
  sections?: RawSection[];
} = {}): InvitationViewModel {
  return invitationViewModelSchema.parse({
    ...baseModelInput,
    couple: { ...baseModelInput.couple, ...input.couple },
    events: input.events ?? baseModelInput.events,
    sections: input.sections ?? baseModelInput.sections,
  });
}

function sectionsWithGalleryCount(count: number): RawSection[] {
  return normalSections.map((section) =>
    section.type === "gallery"
      ? {
          ...section,
          payload: {
            ...section.payload,
            assetIds: Array.from(
              { length: count },
              (_, index) => `rani-bima-gallery-${String(index + 1).padStart(2, "0")}`,
            ),
          },
        }
      : section,
  );
}

function hideOptionalSections(): RawSection[] {
  return normalSections.map((section) =>
    ["story", "gallery", "music", "gift", "faq", "guestbook"].includes(section.type)
      ? { ...section, visible: false }
      : section,
  );
}

const FIXTURE_MODELS: Record<PublicInvitationFixture, InvitationViewModel> = {
  normal: createModel(),
  "long-content": createModel({
    couple: {
      partner1Name:
        "Raden Mas Aditya Pratama Wijaya Kusumawardhana",
      partner2Name:
        "Raden Ayu Sekar Nirmala Puspitasari",
      displayNames:
        "Raden Mas Aditya Pratama Wijaya Kusumawardhana & Raden Ayu Sekar Nirmala Puspitasari",
    },
    events: normalEvents.map((event) => ({
      ...event,
      venueName:
        "Pendopo Agung Puspa Negara Gedung Kebudayaan Jawa Barat dan Taman Keluarga Nusantara",
      address:
        "Jl. Ir. H. Juanda No. 12, Kelurahan Dago, Kecamatan Coblong, Kota Bandung, Jawa Barat 40135",
    })),
  }),
  "missing-optional": createModel({ sections: hideOptionalSections() }),
  "three-events": createModel({ events: [extraEvent, ...normalEvents] }),
  "large-gallery": createModel({ sections: sectionsWithGalleryCount(30) }),
};

const SNAPSHOTS: readonly PublicationSnapshot[] = Object.entries(FIXTURE_MODELS).map(
  ([fixture, model]) => ({
    slug: fixture === "normal" ? "rani-bima" : `rani-bima-${fixture}`,
    templateId: "seruni-klasik",
    templateVersion: "1",
    contractVersion: 1,
    model,
  }),
);

export function isPublicInvitationFixture(
  value: string | undefined,
): value is PublicInvitationFixture {
  return value !== undefined && PUBLIC_INVITATION_FIXTURES.includes(value as PublicInvitationFixture);
}

export function getPublicInvitationFixture(
  fixture: PublicInvitationFixture,
): InvitationViewModel {
  return FIXTURE_MODELS[fixture];
}

export function getPublicInvitationSnapshot(
  slug: string,
  fixture: PublicInvitationFixture = "normal",
): PublicationSnapshot | undefined {
  const snapshotSlug = fixture === "normal" ? slug : `rani-bima-${fixture}`;
  const snapshot = SNAPSHOTS.find(
    (item) =>
      item.slug === snapshotSlug &&
      item.templateId === "seruni-klasik" &&
      item.templateVersion === "1",
  );
  if (snapshot && fixture !== "normal" && slug === "rani-bima") {
    return { ...snapshot, slug };
  }
  return snapshot;
}

export function getPublicInvitationSlugs(): readonly string[] {
  return SNAPSHOTS.map((snapshot) => snapshot.slug);
}
