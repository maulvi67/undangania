import { describe, expect, it } from "vitest";
import {
  filterGuestHouseholds,
  guestListItemSchema,
  parseGuestCsv,
  serializeGuestRosterCsv,
  parseGuestQuery,
  type GuestHouseholdListItem,
} from "./contract";
import { getGuestEvents } from "./fixtures";

const household: GuestHouseholdListItem = {
  id: "household-a",
  displayName: "Keluarga A",
  memberCount: 2,
  maximumPax: 2,
  eventNames: ["Resepsi"],
  tags: ["Keluarga besar"],
  linkStatus: "ACTIVE",
  updatedAt: "2026-09-11T08:00:00.000Z",
};

describe("guest export contract", () => {
  it("serializes deterministic CSV and neutralizes spreadsheet formulas", () => {
    const csv = serializeGuestRosterCsv([
      {
        householdName: 'Keluarga "A"',
        guestName: "=2+2",
        category: "ADULT",
        maximumPax: 2,
        eventNames: ["Akad, Nikah", "Resepsi"],
        linkStatus: "ACTIVE",
      },
      {
        householdName: "Normal",
        guestName: "Budi\nSantoso",
        category: "CHILD",
        maximumPax: 4,
        eventNames: ["Resepsi"],
        linkStatus: "DISABLED",
      },
    ]);

    expect(csv).toBe(
      [
        "nama_rumah_tangga,nama_tamu,kategori_tamu,maksimal_pax,akses_acara,status_tautan",
        '"Keluarga ""A""","\'=2+2","ADULT","2","Akad, Nikah|Resepsi","ACTIVE"',
        '"Normal","Budi\nSantoso","CHILD","4","Resepsi","DISABLED"',
        "",
      ].join("\r\n"),
    );
  });

  it("returns a header-only CSV for an empty roster", () => {
    expect(serializeGuestRosterCsv([])).toBe(
      "nama_rumah_tangga,nama_tamu,kategori_tamu,maksimal_pax,akses_acara,status_tautan\r\n",
    );
  });
});

describe("guest list contract", () => {
  it("parses safe defaults and filters by tenant-owned list fields", () => {
    expect(parseGuestQuery({ q: "  keluarga  " })).toMatchObject({
      q: "keluarga",
      sort: "name",
    });
    expect(
      filterGuestHouseholds(
        [household],
        parseGuestQuery({ tag: "Keluarga besar" }),
      ),
    ).toEqual([household]);
    expect(
      filterGuestHouseholds([household], parseGuestQuery({ link: "DISABLED" })),
    ).toEqual([]);
  });

  it("rejects list DTO fields outside the privacy-safe contract", () => {
    expect(() =>
      guestListItemSchema.parse({
        ...household,
        tenantId: "tenant-a",
        phone: "+628123456789",
        tokenHash: "secret",
      }),
    ).toThrow();
  });
});

describe("guest CSV preview", () => {
  it("classifies valid, invalid, and potential duplicate rows without merging", () => {
    const input = [
      "nama_rumah_tangga,nama_tamu,telepon,email,maksimal_pax,akses_acara,tag",
      "Keluarga A,Ani,,ani@example.id,2,Resepsi,Keluarga besar",
      "Keluarga Baru,,,+bukan-email,0,Acara tidak ada,",
    ].join("\n");
    const preview = parseGuestCsv(input, getGuestEvents(), [household]);
    expect(preview.validCount).toBe(0);
    expect(preview.invalidCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.rows[0]?.duplicateWith).toBe("Keluarga A");
    expect(preview.rows[1]?.issues).toEqual([
      "Nama tamu wajib diisi.",
      "Maksimal pax harus berupa angka lebih besar dari 0.",
      "Acara “Acara tidak ada” tidak ditemukan di workspace ini.",
      "Email belum memiliki format yang benar.",
    ]);
  });
});

describe("token-disabled fixture", () => {
  it("keeps list and detail status consistent", async () => {
    const { getGuestManagementData, getGuestHouseholdDetail } =
      await import("./fixtures");
    const list = getGuestManagementData("token-disabled").households.find(
      (item) => item.id === "household-budi",
    );
    const detail = getGuestHouseholdDetail("household-budi", "token-disabled");
    expect(list?.linkStatus).toBe("DISABLED");
    expect(detail?.linkStatus).toBe("DISABLED");
  });
});
