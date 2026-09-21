import type {
  GuestCapabilitySet,
  GuestEvent,
  GuestFixture,
  GuestHouseholdDetail,
  GuestHouseholdListItem,
  GuestManagementData,
  GuestMember,
  GuestRole,
  GuestTag,
} from "./contract";

const events: readonly GuestEvent[] = [
  { id: "akad", title: "Akad Nikah" },
  { id: "resepsi", title: "Resepsi" },
  { id: "pengajian", title: "Pengajian keluarga" },
];

const tags: readonly GuestTag[] = [
  { id: "keluarga", label: "Keluarga besar" },
  { id: "teman", label: "Teman" },
  { id: "vip", label: "VIP" },
  { id: "luar-kota", label: "Luar kota" },
];

const capabilitiesByRole: Record<GuestRole, GuestCapabilitySet> = {
  OWNER: {
    canRead: true,
    canWrite: true,
    canManageLink: true,
    canImport: true,
    canExport: true,
  },
  EDITOR: {
    canRead: true,
    canWrite: true,
    canManageLink: true,
    canImport: true,
    canExport: true,
  },
  VIEWER: {
    canRead: true,
    canWrite: false,
    canManageLink: false,
    canImport: false,
    canExport: false,
  },
};

function household(
  input: Omit<GuestHouseholdListItem, "updatedAt"> & { updatedAt?: string },
): GuestHouseholdListItem {
  return {
    ...input,
    updatedAt: input.updatedAt ?? "2026-09-11T08:00:00.000Z",
  };
}

const households: readonly GuestHouseholdListItem[] = [
  household({
    id: "household-budi",
    displayName: "Keluarga Budi Santoso",
    memberCount: 3,
    maximumPax: 4,
    eventNames: ["Akad Nikah", "Resepsi"],
    tags: ["Keluarga besar", "VIP"],
    linkStatus: "ACTIVE",
  }),
  household({
    id: "household-sari",
    displayName: "Sari & keluarga",
    memberCount: 2,
    maximumPax: 2,
    eventNames: ["Resepsi"],
    tags: ["Teman"],
    linkStatus: "ACTIVE",
    updatedAt: "2026-09-10T08:00:00.000Z",
  }),
  household({
    id: "household-rizal",
    displayName: "Keluarga Rizal Pratama",
    memberCount: 5,
    maximumPax: 6,
    eventNames: ["Akad Nikah", "Resepsi", "Pengajian keluarga"],
    tags: ["Keluarga besar", "Luar kota"],
    linkStatus: "ACTIVE",
    updatedAt: "2026-09-09T08:00:00.000Z",
  }),
  household({
    id: "household-nadia",
    displayName: "Nadia & Arif",
    memberCount: 2,
    maximumPax: 2,
    eventNames: ["Resepsi"],
    tags: ["Teman"],
    linkStatus: "DISABLED",
    updatedAt: "2026-09-08T08:00:00.000Z",
  }),
  household({
    id: "household-ibu-rani",
    displayName: "Ibu Rani dan keluarga",
    memberCount: 4,
    maximumPax: 5,
    eventNames: ["Akad Nikah", "Resepsi"],
    tags: ["Keluarga besar"],
    linkStatus: "ACTIVE",
    updatedAt: "2026-09-07T08:00:00.000Z",
  }),
  household({
    id: "household-dimas",
    displayName: "Dimas Kurniawan",
    memberCount: 1,
    maximumPax: 1,
    eventNames: ["Resepsi"],
    tags: ["Teman"],
    linkStatus: "ACTIVE",
    updatedAt: "2026-09-06T08:00:00.000Z",
  }),
];

const members: Record<string, readonly GuestMember[]> = {
  "household-budi": [
    { id: "guest-budi-1", displayName: "Budi Santoso", category: "ADULT" },
    { id: "guest-budi-2", displayName: "Rina Santoso", category: "ADULT" },
    { id: "guest-budi-3", displayName: "Alya Santoso", category: "CHILD" },
  ],
  "household-sari": [
    { id: "guest-sari-1", displayName: "Sari Wulandari", category: "ADULT" },
    { id: "guest-sari-2", displayName: "Dewi Wulandari", category: "ADULT" },
  ],
  "household-rizal": [
    { id: "guest-rizal-1", displayName: "Rizal Pratama", category: "ADULT" },
    { id: "guest-rizal-2", displayName: "Maya Pratama", category: "ADULT" },
    { id: "guest-rizal-3", displayName: "Faris Pratama", category: "ADULT" },
    { id: "guest-rizal-4", displayName: "Naya Pratama", category: "CHILD" },
    { id: "guest-rizal-5", displayName: "Raka Pratama", category: "CHILD" },
  ],
  "household-nadia": [
    { id: "guest-nadia-1", displayName: "Nadia Rahma", category: "ADULT" },
    { id: "guest-nadia-2", displayName: "Arif Rahman", category: "ADULT" },
  ],
  "household-ibu-rani": [
    { id: "guest-rani-1", displayName: "Rani Kusuma", category: "ADULT" },
    { id: "guest-rani-2", displayName: "Eko Kusuma", category: "ADULT" },
    { id: "guest-rani-3", displayName: "Dita Kusuma", category: "ADULT" },
    { id: "guest-rani-4", displayName: "Rafi Kusuma", category: "CHILD" },
  ],
  "household-dimas": [
    { id: "guest-dimas-1", displayName: "Dimas Kurniawan", category: "ADULT" },
  ],
};

export function getGuestEvents(): readonly GuestEvent[] {
  return events;
}

export function getGuestTags(): readonly GuestTag[] {
  return tags;
}

export function getGuestHouseholds(): readonly GuestHouseholdListItem[] {
  return households;
}

export function getGuestManagementData(
  fixture: GuestFixture = "normal",
  role: GuestRole = "OWNER",
): GuestManagementData {
  const noticeByFixture: Partial<
    Record<GuestFixture, GuestManagementData["notice"]>
  > = {
    "import-processing": {
      tone: "info",
      title: "Sedang memproses impor",
      body: "File CSV sedang diperiksa. Anda dapat menutup panel ini dan kembali lagi nanti.",
    },
    "invalid-csv": {
      tone: "warning",
      title: "File CSV perlu diperbaiki",
      body: "Kolom wajib belum lengkap atau beberapa baris tidak dapat dibaca.",
    },
    "partial-import": {
      tone: "warning",
      title: "Sebagian data berhasil diimpor",
      body: "34 baris berhasil dimasukkan. 2 baris dilewati karena kesalahan.",
    },
    "potential-duplicate": {
      tone: "warning",
      title: "Ada duplikat potensial",
      body: "2 baris mungkin cocok dengan rumah tangga yang sudah ada. Tidak ada data yang digabung otomatis.",
    },

  };

  const fixtureHouseholds =
    fixture === "empty"
      ? []
      : fixture === "token-disabled"
        ? households.map((household) =>
            household.id === "household-budi"
              ? { ...household, linkStatus: "DISABLED" as const }
              : household,
          )
        : households;
  const fixtureRole = fixture === "permission-denied" ? "VIEWER" : role;
  const capabilities =
    fixture === "permission-denied"
      ? { ...capabilitiesByRole.VIEWER, canRead: false }
      : capabilitiesByRole[fixtureRole];
  return {
    workspaceName: "Pernikahan Rani & Bima",
    coupleNames: "Rani & Bima",
    events,
    tags,
    households: fixtureHouseholds,
    totalGuests: fixtureHouseholds.reduce(
      (total, item) => total + item.memberCount,
      0,
    ),
    role: fixtureRole,
    capabilities,
    notice: noticeByFixture[fixture] ?? null,
  };
}

export function getGuestHouseholdDetail(
  householdId: string,
  fixture: GuestFixture = "normal",
  role: GuestRole = "OWNER",
): GuestHouseholdDetail | undefined {
  const item = getGuestManagementData(fixture, role).households.find(
    (household) => household.id === householdId,
  );
  if (!item) return undefined;
  const memberList = members[householdId] ?? [];
  const eventIds = item.eventNames
    .map((name) => events.find((event) => event.title === name)?.id)
    .filter((id): id is string => id !== undefined);
  const detail: GuestHouseholdDetail = {
    ...item,
    members: memberList,
    eventIds,
    phoneMasked: "+62 •••• 1234",
    emailMasked: "b•••@contoh.id",
    tokenVersion: 1,
  };
  if (fixture === "token-disabled") {
    return { ...detail, linkStatus: "DISABLED" };
  }
  if (role === "VIEWER") return detail;
  return detail;
}

export function getGuestCapabilitySet(role: GuestRole): GuestCapabilitySet {
  return capabilitiesByRole[role];
}
