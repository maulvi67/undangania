import { z } from "zod";

export const GUEST_FIXTURES = [
  "normal",
  "empty",
  "import-processing",
  "invalid-csv",
  "partial-import",
  "potential-duplicate",
  "token-disabled",
  "permission-denied",
  "unavailable",
] as const;

export type GuestFixture = (typeof GUEST_FIXTURES)[number];
export type GuestRole = "OWNER" | "EDITOR" | "VIEWER";
export type GuestLinkStatus = "ACTIVE" | "DISABLED";
export type GuestMemberCategory = "ADULT" | "CHILD" | "OTHER";
export type GuestSort = "name" | "updated" | "pax-desc" | "pax-asc";

export type GuestCapabilitySet = Readonly<{
  canRead: boolean;
  canWrite: boolean;
  canManageLink: boolean;
  canImport: boolean;
  canExport: boolean;
}>;

export type GuestEvent = Readonly<{
  id: string;
  title: string;
}>;

export type GuestTag = Readonly<{
  id: string;
  label: string;
}>;

export type GuestMember = Readonly<{
  id: string;
  displayName: string;
  category: GuestMemberCategory;
}>;

/**
 * The privacy-safe row shape used to build a roster export. Encrypted contact
 * values, token hashes, tenant identifiers, and audit metadata are intentionally
 * outside this contract.
 */
export type GuestExportRow = Readonly<{
  householdName: string;
  guestName: string;
  category: string;
  maximumPax: number;
  eventNames: readonly string[];
  linkStatus: GuestLinkStatus;
}>;

export const GUEST_EXPORT_HEADERS = [
  "nama_rumah_tangga",
  "nama_tamu",
  "kategori_tamu",
  "maksimal_pax",
  "akses_acara",
  "status_tautan",
] as const;

/**
 * Prefixes spreadsheet formula-like values before RFC 4180 quoting. Quoting
 * protects the CSV structure, while the prefix prevents a spreadsheet from
 * evaluating a guest name or household name as a formula after opening it.
 */
function safeCsvCell(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n");
  const protectedValue = /^\s*[=+\-@]/u.test(normalized)
    ? `'${normalized}`
    : normalized;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function serializeGuestRosterCsv(
  rows: readonly GuestExportRow[],
): string {
  const lines = [GUEST_EXPORT_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.householdName,
        row.guestName,
        row.category,
        String(row.maximumPax),
        row.eventNames.join("|"),
        row.linkStatus,
      ]
        .map(safeCsvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * List-safe household data. This type intentionally has no tenant ID, token,
 * contact value, hash, or internal audit data.
 */
export type GuestHouseholdListItem = Readonly<{
  id: string;
  displayName: string;
  memberCount: number;
  maximumPax: number;
  eventNames: readonly string[];
  tags: readonly string[];
  linkStatus: GuestLinkStatus;
  updatedAt: string;
}>;

/**
 * Detail-only data. `personalizedLink` is present only in the development
 * fixture and represents the one-time response that a real API would return
 * after creation or rotation. It is never part of list results.
 */
export type GuestHouseholdDetail = GuestHouseholdListItem &
  Readonly<{
    members: readonly GuestMember[];
    eventIds: readonly string[];
    phoneMasked: string | null;
    emailMasked: string | null;
    tokenVersion: number;
    personalizedLink?: string;
  }>;

export type GuestManagementData = Readonly<{
  workspaceName: string;
  coupleNames: string;
  events: readonly GuestEvent[];
  tags: readonly GuestTag[];
  households: readonly GuestHouseholdListItem[];
  totalGuests: number;
  role: GuestRole;
  capabilities: GuestCapabilitySet;
  notice: GuestNotice | null;
}>;

export type GuestNotice = Readonly<{
  tone: "info" | "success" | "warning";
  title: string;
  body: string;
}>;

export type GuestLoadResult =
  | Readonly<{ kind: "ok"; data: GuestManagementData }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;

export type GuestDetailLoadResult =
  | Readonly<{
      kind: "ok";
      data: Readonly<{
        household: GuestHouseholdDetail;
        management: GuestManagementData;
        /** Null until the invitation is published. */
        invitationSlug: string | null;
      }>;
    }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable" }>;

export type GuestListQuery = Readonly<{
  fixture: GuestFixture;
  q: string;
  tag: string;
  event: string;
  link: "" | GuestLinkStatus;
  sort: GuestSort;
}>;

export const guestListItemSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1).max(200),
    memberCount: z.number().int().positive(),
    maximumPax: z.number().int().positive(),
    eventNames: z.array(z.string().min(1)),
    tags: z.array(z.string().min(1)),
    linkStatus: z.enum(["ACTIVE", "DISABLED"]),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const guestDetailSchema = guestListItemSchema
  .extend({
    members: z.array(
      z.object({
        id: z.string().min(1),
        displayName: z.string().min(1).max(200),
        category: z.enum(["ADULT", "CHILD", "OTHER"]),
      }),
    ),
    eventIds: z.array(z.string().min(1)),
    phoneMasked: z.string().nullable(),
    emailMasked: z.string().nullable(),
    tokenVersion: z.number().int().positive(),
    personalizedLink: z.string().url().optional(),
  })
  .strict();

export const guestListQuerySchema = z.object({
  fixture: z.enum(GUEST_FIXTURES).default("normal"),
  q: z.string().trim().max(100).default(""),
  tag: z.string().trim().max(80).default(""),
  event: z.string().trim().max(80).default(""),
  link: z.enum(["", "ACTIVE", "DISABLED"]).default(""),
  sort: z.enum(["name", "updated", "pax-desc", "pax-asc"]).default("name"),
});

export type GuestImportRowStatus = "valid" | "invalid" | "duplicate";

export type GuestImportRow = Readonly<{
  rowNumber: number;
  householdName: string;
  guestName: string;
  maximumPax: number | null;
  eventNames: readonly string[];
  tag: string;
  hasPhone: boolean;
  hasEmail: boolean;
  status: GuestImportRowStatus;
  issues: readonly string[];
  duplicateWith: string | null;
}>;

export type GuestImportPreview = Readonly<{
  headersValid: boolean;
  headerIssues: readonly string[];
  rows: readonly GuestImportRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}>;

export const guestImportHeaderLabels = [
  "nama_rumah_tangga",
  "nama_tamu",
  "telepon",
  "email",
  "maksimal_pax",
  "akses_acara",
  "tag",
] as const;

const sortValues: readonly GuestSort[] = [
  "name",
  "updated",
  "pax-desc",
  "pax-asc",
];

export function isGuestFixture(
  value: string | undefined,
): value is GuestFixture {
  return value !== undefined && GUEST_FIXTURES.includes(value as GuestFixture);
}

export function parseGuestFixture(
  value: string | string[] | undefined,
): GuestFixture {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isGuestFixture(candidate) ? candidate : "normal";
}

export function parseGuestQuery(input: {
  fixture?: string | string[];
  q?: string | string[];
  tag?: string | string[];
  event?: string | string[];
  link?: string | string[];
  sort?: string | string[];
}): GuestListQuery {
  const first = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const parsed = guestListQuerySchema.parse({
    fixture: first(input.fixture) || "normal",
    q: first(input.q),
    tag: first(input.tag),
    event: first(input.event),
    link: first(input.link),
    sort: first(input.sort) || "name",
  });
  return parsed;
}

export function guestQueryHref(
  query: GuestListQuery,
  patch: Partial<Omit<GuestListQuery, "fixture">> = {},
): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.fixture !== "normal") params.set("fixture", next.fixture);
  if (next.q) params.set("q", next.q);
  if (next.tag) params.set("tag", next.tag);
  if (next.event) params.set("event", next.event);
  if (next.link) params.set("link", next.link);
  if (next.sort !== "name") params.set("sort", next.sort);
  const search = params.toString();
  return search ? `/tamu?${search}` : "/tamu";
}

export function filterGuestHouseholds(
  households: readonly GuestHouseholdListItem[],
  query: GuestListQuery,
): readonly GuestHouseholdListItem[] {
  const term = query.q.toLocaleLowerCase("id-ID");
  const filtered = households.filter((household) => {
    const searchable = [
      household.displayName,
      ...household.eventNames,
      ...household.tags,
    ]
      .join(" ")
      .toLocaleLowerCase("id-ID");
    const matchesQuery = term === "" || searchable.includes(term);
    const matchesTag = query.tag === "" || household.tags.includes(query.tag);
    const matchesEvent =
      query.event === "" || household.eventNames.includes(query.event);
    const matchesLink =
      query.link === "" || household.linkStatus === query.link;
    return matchesQuery && matchesTag && matchesEvent && matchesLink;
  });

  return [...filtered].sort((left, right) => {
    if (query.sort === "updated")
      return right.updatedAt.localeCompare(left.updatedAt);
    if (query.sort === "pax-desc") return right.maximumPax - left.maximumPax;
    if (query.sort === "pax-asc") return left.maximumPax - right.maximumPax;
    return left.displayName.localeCompare(right.displayName, "id-ID");
  });
}

export function formatGuestSort(value: GuestSort): string {
  if (value === "updated") return "Terakhir diubah";
  if (value === "pax-desc") return "Maksimal pax terbesar";
  if (value === "pax-asc") return "Maksimal pax terkecil";
  return "Nama A–Z";
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function splitCsvLines(input: string): readonly string[] {
  const lines: string[] = [];
  let line = "";
  let quoted = false;
  for (const character of input.replace(/^\uFEFF/, "")) {
    if (character === '"') quoted = !quoted;
    if ((character === "\n" || character === "\r") && !quoted) {
      if (line.trim() !== "") lines.push(line);
      line = "";
      continue;
    }
    line += character;
  }
  if (line.trim() !== "") lines.push(line);
  return lines;
}

export function parseGuestCsv(
  input: string,
  events: readonly GuestEvent[],
  existingHouseholds: readonly GuestHouseholdListItem[] = [],
): GuestImportPreview {
  const lines = splitCsvLines(input);
  const rawHeaders = lines[0] ? splitCsvLine(lines[0]).map(normalize) : [];
  const missingHeaders = guestImportHeaderLabels
    .slice(0, 2)
    .filter((header) => !rawHeaders.includes(header));
  const headerIssues = missingHeaders.map(
    (header) => `Kolom wajib “${header}” belum tersedia.`,
  );
  if (lines.length < 2 || missingHeaders.length > 0) {
    return {
      headersValid: missingHeaders.length === 0,
      headerIssues:
        lines.length < 2
          ? [...headerIssues, "File belum memiliki baris data."]
          : headerIssues,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
    };
  }

  const headerIndex = new Map(
    rawHeaders.map((header, index) => [header, index]),
  );
  const rows: GuestImportRow[] = lines.slice(1).map((line, lineIndex) => {
    const cells = splitCsvLine(line);
    const value = (header: string): string =>
      cells[headerIndex.get(header) ?? -1] ?? "";
    const householdName = value("nama_rumah_tangga");
    const guestName = value("nama_tamu");
    const paxValue = value("maksimal_pax");
    const maximumPax = paxValue === "" ? 1 : Number(paxValue);
    const eventNames = value("akses_acara")
      .split(/[|;]/)
      .map((event) => event.trim())
      .filter(Boolean);
    const issues: string[] = [];
    if (householdName === "") issues.push("Nama rumah tangga wajib diisi.");
    if (guestName === "") issues.push("Nama tamu wajib diisi.");
    if (!Number.isInteger(maximumPax) || maximumPax < 1) {
      issues.push("Maksimal pax harus berupa angka lebih besar dari 0.");
    }
    const unknownEvents = eventNames.filter(
      (eventName) => !events.some((event) => event.title === eventName),
    );
    if (unknownEvents.length > 0) {
      issues.push(
        `Acara “${unknownEvents[0]}” tidak ditemukan di workspace ini.`,
      );
    }
    const phone = value("telepon");
    const email = value("email");
    if (email !== "" && !/^\S+@\S+\.\S+$/.test(email)) {
      issues.push("Email belum memiliki format yang benar.");
    }

    const duplicate = existingHouseholds.find(
      (household) =>
        normalize(household.displayName) === normalize(householdName),
    );
    const status: GuestImportRowStatus =
      issues.length > 0 ? "invalid" : duplicate ? "duplicate" : "valid";
    return {
      rowNumber: lineIndex + 2,
      householdName,
      guestName,
      maximumPax:
        Number.isInteger(maximumPax) && maximumPax > 0 ? maximumPax : null,
      eventNames,
      tag: value("tag"),
      hasPhone: phone !== "",
      hasEmail: email !== "",
      status,
      issues,
      duplicateWith: duplicate?.displayName ?? null,
    };
  });
  const validCount = rows.filter((row) => row.status === "valid").length;
  const invalidCount = rows.filter((row) => row.status === "invalid").length;
  const duplicateCount = rows.filter(
    (row) => row.status === "duplicate",
  ).length;
  return {
    headersValid: true,
    headerIssues: [],
    rows,
    validCount,
    invalidCount,
    duplicateCount,
  };
}

export function guestSortValues(): readonly GuestSort[] {
  return sortValues;
}

export const GUEST_HOUSEHOLD_NAME_MAX = 200;
export const GUEST_MEMBER_NAME_MAX = 200;
export const GUEST_MAXIMUM_PAX_CEILING = 20;

const guestMemberInputSchema = z.object({
  displayName: z.string().trim().min(1).max(GUEST_MEMBER_NAME_MAX),
  category: z.enum(["ADULT", "CHILD", "OTHER"]).default("ADULT"),
});

export const guestHouseholdCreateSchema = z.object({
  displayName: z.string().trim().min(1).max(GUEST_HOUSEHOLD_NAME_MAX),
  maximumPax: z.number().int().min(1).max(GUEST_MAXIMUM_PAX_CEILING),
  members: z.array(guestMemberInputSchema).min(1),
});

export type GuestHouseholdCreateInput = z.infer<
  typeof guestHouseholdCreateSchema
>;

/**
 * The update body. Every field is required because the form always submits the
 * whole household; a partial patch would let a stale client silently revert a
 * field it never rendered.
 */
export const GUEST_EXPORT_MAX_HOUSEHOLDS = 5_000;

export const guestExportInputSchema = z
  .object({
    /** Undefined means the complete tenant-scoped roster; an array is exact. */
    householdIds: z
      .array(z.string().trim().min(1).max(100))
      .max(GUEST_EXPORT_MAX_HOUSEHOLDS)
      .optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.householdIds === undefined ||
      new Set(input.householdIds).size === input.householdIds.length,
    { message: "Daftar rumah tangga untuk ekspor tidak boleh duplikat." },
  );

export const guestHouseholdUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(GUEST_HOUSEHOLD_NAME_MAX),
  maximumPax: z.number().int().min(1).max(GUEST_MAXIMUM_PAX_CEILING),
  members: z.array(guestMemberInputSchema).min(1),
});

export type GuestHouseholdUpdateInput = z.infer<
  typeof guestHouseholdUpdateSchema
>;

/**
 * One imported household: its display name, its members, and its allowance.
 *
 * The CSV parser already groups rows by household, so this is the shape the wizard
 * hands over — one entry per household rather than one per person, which is what
 * makes the import a bounded set of inserts rather than a per-row write.
 */
export const guestImportRowSchema = z.object({
  householdName: z.string().trim().min(1).max(GUEST_HOUSEHOLD_NAME_MAX),
  memberNames: z
    .array(z.string().trim().min(1).max(GUEST_MEMBER_NAME_MAX))
    .min(1),
  maximumPax: z.number().int().min(1).max(GUEST_MAXIMUM_PAX_CEILING),
});

export const guestImportRowsSchema = z.array(guestImportRowSchema);

export type GuestImportRowInput = z.infer<typeof guestImportRowSchema>;
