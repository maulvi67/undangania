import { describe, expect, it } from "vitest";
import {
  ADDRESS_MAX_LENGTH,
  CITY_MAX_LENGTH,
  EVENT_TYPES,
  NAME_MAX_LENGTH,
  VENUE_MAX_LENGTH,
  coupleStepSchema,
  createInitialData,
  eventStepSchema,
  formatEventLine,
  formatWeddingDate,
  hasAnyInput,
  isPastDay,
  isValidTime,
  isValidYmd,
  preferencesStepSchema,
  todayYmd,
  translateFieldErrors,
} from "./contract";
import { stubCompleteStep, stubGetDraft, stubSaveStep } from "./stub-transport";

/* Hari dihitung per-tes untuk meminimalkan jendela lintas tengah malam. */
function shiftDays(ymd: string, days: number): string {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10)) + days;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function validCoupleData(): {
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  weddingDateUndecided: boolean;
} {
  return {
    partner1Name: "Rani",
    partner2Name: "Bima",
    weddingDate: "",
    weddingDateUndecided: false,
  };
}

function validEventData(): {
  eventType: string;
  eventDate: string;
  eventTime: string;
  city: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
} {
  return {
    eventType: "Akad Nikah",
    eventDate: shiftDays(todayYmd("Asia/Jakarta"), 30),
    eventTime: "08:00",
    city: "Bandung",
    timezone: "Asia/Jakarta",
    venueName: "Gedung Melati",
    venueAddress: "Jl. Kenanga No. 1",
  };
}

describe("validasi tanggal dan waktu", () => {
  it("menerima tanggal kalender nyata dan menolak yang mustahil", () => {
    expect(isValidYmd("2026-03-21")).toBe(true);
    expect(isValidYmd("2024-02-29")).toBe(true);
    expect(isValidYmd("2023-02-29")).toBe(false);
    expect(isValidYmd("2026-02-30")).toBe(false);
    expect(isValidYmd("2026-13-01")).toBe(false);
    expect(isValidYmd("21-03-2026")).toBe(false);
    expect(isValidYmd("21/03/2026")).toBe(false);
    expect(isValidYmd("")).toBe(false);
  });

  it("todayYmd menghasilkan format ISO yang valid", () => {
    const today = todayYmd();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidYmd(today)).toBe(true);
  });

  it("isPastDay: hari ini boleh, kemarin tidak, tanggal rusak bukan masa lalu", () => {
    const today = todayYmd("Asia/Jakarta");
    expect(isPastDay(today, today)).toBe(false);
    expect(isPastDay(shiftDays(today, -1), today)).toBe(true);
    expect(isPastDay(shiftDays(today, 1), today)).toBe(false);
    expect(isPastDay("", today)).toBe(false);
  });

  it("isValidTime menolak jam dan menit di luar jangkauan", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("08:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("25:00")).toBe(false);
    expect(isValidTime("09:60")).toBe(false);
    expect(isValidTime("8:00")).toBe(false);
    expect(isValidTime("")).toBe(false);
  });
});

describe("coupleStepSchema", () => {
  it("menerima nama lengkap tanpa tanggal pernikahan", () => {
    const parsed = coupleStepSchema.safeParse(validCoupleData());
    expect(parsed.success).toBe(true);
  });

  it("menolak nama kosong dengan pesan per isian", () => {
    const parsed = coupleStepSchema.safeParse({
      ...validCoupleData(),
      partner1Name: "",
      partner2Name: " ",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(translateFieldErrors(parsed.error.issues)).toEqual({
        partner1Name: "Masukkan nama mempelai pertama.",
        partner2Name: "Masukkan nama mempelai kedua.",
      });
    }
  });

  it("menolak tanggal pernikahan di masa lalu, menerima hari ini", () => {
    const today = todayYmd("Asia/Jakarta");
    const past = coupleStepSchema.safeParse({
      ...validCoupleData(),
      weddingDate: shiftDays(today, -1),
    });
    expect(past.success).toBe(false);
    if (!past.success) {
      expect(translateFieldErrors(past.error.issues)).toEqual({
        weddingDate: "Tanggal pernikahan tidak boleh di masa lalu.",
      });
    }
    expect(coupleStepSchema.safeParse({ ...validCoupleData(), weddingDate: today }).success).toBe(
      true,
    );
  });

  it("melewati validasi tanggal saat 'belum ditentukan' dicentang", () => {
    const today = todayYmd("Asia/Jakarta");
    const parsed = coupleStepSchema.safeParse({
      ...validCoupleData(),
      weddingDate: shiftDays(today, -10),
      weddingDateUndecided: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("menolak nama melebihi panjang maksimum", () => {
    const parsed = coupleStepSchema.safeParse({
      ...validCoupleData(),
      partner1Name: "a".repeat(NAME_MAX_LENGTH + 1),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(translateFieldErrors(parsed.error.issues)).toEqual({
        partner1Name: "Nama maksimal 100 karakter.",
      });
    }
  });
});

describe("eventStepSchema", () => {
  it("menerima data acara lengkap", () => {
    expect(eventStepSchema.safeParse(validEventData()).success).toBe(true);
  });

  it("menolak isian wajib kosong dengan pesan masing-masing", () => {
    // Enum berisi default UI yang selalu sah; string kosong adalah kondisi
    // yang benar-benar bisa dikirim pengguna.
    const parsed = eventStepSchema.safeParse({
      eventType: "Akad Nikah",
      eventDate: "",
      eventTime: "",
      city: " ",
      timezone: "Asia/Jakarta",
      venueName: "",
      venueAddress: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(translateFieldErrors(parsed.error.issues)).toEqual({
        eventDate: "Masukkan tanggal acara.",
        eventTime: "Masukkan waktu acara.",
        city: "Masukkan kota acara.",
        venueName: "Masukkan nama venue.",
      });
    }
  });

  it("menolak tanggal acara di masa lalu, menerima hari ini", () => {
    const today = todayYmd("Asia/Jakarta");
    const past = eventStepSchema.safeParse({ ...validEventData(), eventDate: shiftDays(today, -1) });
    expect(past.success).toBe(false);
    if (!past.success) {
      expect(translateFieldErrors(past.error.issues)).toEqual({
        eventDate: "Tanggal acara tidak boleh di masa lalu.",
      });
    }
    expect(eventStepSchema.safeParse({ ...validEventData(), eventDate: today }).success).toBe(
      true,
    );
  });

  it("menolak nilai enum yang tidak dikenal (hanya bisa lewat manipulasi langsung)", () => {
    const eventType = eventStepSchema.safeParse({ ...validEventData(), eventType: "Seminar" });
    expect(eventType.success).toBe(false);
    if (!eventType.success) {
      expect(translateFieldErrors(eventType.error.issues)).toEqual({
        eventType: "Pilih jenis acara.",
      });
    }
    const timezone = eventStepSchema.safeParse({ ...validEventData(), timezone: "Asia/Mars" });
    expect(timezone.success).toBe(false);
    if (!timezone.success) {
      expect(translateFieldErrors(timezone.error.issues)).toEqual({
        timezone: "Pilih zona waktu.",
      });
    }
  });

  it("menolak format tanggal dan waktu tidak sah dengan pesan yang tepat", () => {
    const invalid = eventStepSchema.safeParse({
      ...validEventData(),
      eventDate: "21/03/2026",
      eventTime: "25:00",
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(translateFieldErrors(invalid.error.issues)).toEqual({
        eventDate: "Masukkan tanggal yang valid.",
        eventTime: "Masukkan waktu acara.",
      });
    }
  });

  it("menolak kota, venue, dan alamat melebihi panjang maksimum", () => {
    const parsed = eventStepSchema.safeParse({
      ...validEventData(),
      city: "c".repeat(CITY_MAX_LENGTH + 1),
      venueName: "v".repeat(VENUE_MAX_LENGTH + 1),
      venueAddress: "a".repeat(ADDRESS_MAX_LENGTH + 1),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(translateFieldErrors(parsed.error.issues)).toEqual({
        city: "Kota maksimal 100 karakter.",
        venueName: "Nama venue maksimal 150 karakter.",
        venueAddress: "Alamat maksimal 500 karakter.",
      });
    }
  });

  it("menerima alamat kosong (opsional)", () => {
    const parsed = eventStepSchema.safeParse({ ...validEventData(), venueAddress: "" });
    expect(parsed.success).toBe(true);
  });
});

describe("preferencesStepSchema", () => {
  it("menerima id dan en, menolak lainnya", () => {
    expect(preferencesStepSchema.safeParse({ locale: "id" }).success).toBe(true);
    expect(preferencesStepSchema.safeParse({ locale: "en" }).success).toBe(true);
    const parsed = preferencesStepSchema.safeParse({ locale: "fr" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(translateFieldErrors(parsed.error.issues)).toEqual({
        locale: "Pilih bahasa undangan.",
      });
    }
  });
});

describe("translateFieldErrors", () => {
  it("mengabaikan isu tanpa path isian yang dikenal", () => {
    expect(translateFieldErrors([{ code: "custom", message: "x" }])).toEqual({});
    expect(translateFieldErrors([{ code: "custom", message: "x", path: [] }])).toEqual({});
    expect(translateFieldErrors([{ code: "custom", message: "x", path: ["unknown"] }])).toEqual(
      {},
    );
  });

  it("memetakan too_big ke pesan panjang maksimum dan sisanya ke pesan wajib", () => {
    expect(translateFieldErrors([{ code: "too_big", message: "z", path: ["city"] }])).toEqual({
      city: "Kota maksimal 100 karakter.",
    });
    expect(
      translateFieldErrors([{ code: "invalid_type", message: "z", path: ["venueName"] }]),
    ).toEqual({ venueName: "Masukkan nama venue." });
  });
});

describe("format tampilan", () => {
  it("menyusun baris acara dengan hari, tanggal, waktu, dan label zona (jangkar UTC)", () => {
    const base = {
      eventType: "Akad Nikah" as const,
      eventDate: "2026-03-21",
      eventTime: "08:00",
      timezone: "Asia/Jakarta" as const,
    };
    expect(formatEventLine(base)).toBe("Akad Nikah — Sabtu, 21 Maret 2026 pukul 08.00 WIB");
    expect(formatEventLine({ ...base, timezone: "Asia/Makassar" })).toBe(
      "Akad Nikah — Sabtu, 21 Maret 2026 pukul 08.00 WITA",
    );
    expect(formatEventLine(base, "en")).toBe(
      "Akad Nikah — Saturday, 21 March 2026 at 08:00 WIB",
    );
  });

  it("menampilkan tanggal pernikahan: terisi, kosong, dan eksplisit belum ditentukan", () => {
    expect(formatWeddingDate({ weddingDate: "2026-03-21", weddingDateUndecided: false })).toBe(
      "21 Maret 2026",
    );
    expect(formatWeddingDate({ weddingDate: "", weddingDateUndecided: false })).toBe(
      "Belum ditentukan",
    );
    expect(
      formatWeddingDate({ weddingDate: "2026-03-21", weddingDateUndecided: true }),
    ).toBe("Belum ditentukan");
  });
});

describe("data awal dan deteksi isian", () => {
  it("createInitialData memakai default Indonesia (WIB, Bahasa Indonesia, Akad Nikah)", () => {
    const initial = createInitialData();
    expect(initial.timezone).toBe("Asia/Jakarta");
    expect(initial.locale).toBe("id");
    expect(initial.eventType).toBe("Akad Nikah");
    expect(initial.weddingDate).toBe("");
    expect(initial.weddingDateUndecided).toBe(false);
  });

  it("hasAnyInput: kondisi awal dan spasi tidak dihitung; perubahan nyata dihitung", () => {
    const initial = createInitialData();
    expect(hasAnyInput(initial)).toBe(false);
    expect(hasAnyInput({ ...initial, partner1Name: "   " })).toBe(false);
    expect(hasAnyInput({ ...initial, partner1Name: "Rani" })).toBe(true);
    expect(hasAnyInput({ ...initial, weddingDateUndecided: true })).toBe(true);
    expect(hasAnyInput({ ...initial, eventType: "Resepsi" })).toBe(true);
    expect(hasAnyInput({ ...initial, city: "Bandung" })).toBe(true);
  });

  it("katalog jenis acara berisi nilai yang dijanjikan", () => {
    expect([...EVENT_TYPES]).toEqual(["Akad Nikah", "Resepsi", "Unduh Mantu", "Lainnya"]);
  });
});

describe("stub transport determinism", () => {
  it("simpan pertama membuat versi 1, simpan berikutnya menaikkan versi", async () => {
    const id = "stub-save-1";
    const first = await stubSaveStep(id, 1, { partner1Name: "Rani", partner2Name: "Bima" }, 0, false);
    expect(first).toEqual({ ok: true, version: 1 });
    const second = await stubSaveStep(id, 2, { city: "Bandung" }, 1, false);
    expect(second).toEqual({ ok: true, version: 2 });
    const draft = stubGetDraft(id);
    expect(draft?.data.partner1Name).toBe("Rani");
    expect(draft?.data.city).toBe("Bandung");
  });

  it("versi basis basi memicu STALE_VERSION dengan data server", async () => {
    const id = "stub-save-2";
    await stubSaveStep(id, 1, { partner1Name: "Rani" }, 0, false);
    await stubSaveStep(id, 1, { partner2Name: "Bima" }, 1, false);
    const stale = await stubSaveStep(id, 1, { partner1Name: "Sinta" }, 1, false);
    expect(stale.ok).toBe(false);
    if (!stale.ok && stale.code === "STALE_VERSION") {
      expect(stale.serverVersion).toBe(2);
      expect(stale.serverData.partner2Name).toBe("Bima");
    }
  });

  it("force menimpa draf server dan tetap menaikkan versi", async () => {
    const id = "stub-save-3";
    await stubSaveStep(id, 1, { partner1Name: "Rani" }, 0, false);
    await stubSaveStep(id, 1, { partner2Name: "Bima" }, 1, false);
    const forced = await stubSaveStep(id, 1, { partner1Name: "Sinta" }, 1, true);
    expect(forced).toEqual({ ok: true, version: 3 });
    expect(stubGetDraft(id)?.data.partner1Name).toBe("Sinta");
  });

  it("fixture kota gagal-simpan memicu SAVE_FAILED", async () => {
    const result = await stubSaveStep("stub-fail-1", 2, { city: "gagal-simpan" }, 0, false);
    expect(result).toEqual({ ok: false, code: "SAVE_FAILED" });
  });

  it("fixture venue versi-lama memicu STALE_VERSION deterministik", async () => {
    const id = "stub-fail-2";
    const existing = await stubSaveStep(id, 2, { city: "Bandung" }, 0, false);
    expect(existing.ok && existing.version === 1).toBe(true);
    const conflict = await stubSaveStep(id, 2, { venueName: "versi-lama" }, 1, false);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok && conflict.code === "STALE_VERSION") {
      expect(conflict.serverVersion).toBe(2);
      expect(conflict.serverData.city).toBe("Bandung");
    }
  });

  it("menyelesaikan draf: menggabungkan semua langkah dan menandai selesai", async () => {
    const id = "stub-complete-1";
    await stubSaveStep(id, 1, { partner1Name: "Rani", partner2Name: "Bima" }, 0, false);
    await stubSaveStep(
      id,
      2,
      { city: "Bandung", venueName: "Gedung Melati", eventDate: "2026-12-05", eventTime: "08:00" },
      1,
      false,
    );
    const completed = await stubCompleteStep(id, { locale: "en" }, 2, false);
    expect(completed.ok).toBe(true);
    if (completed.ok) {
      expect(completed.version).toBe(3);
      expect(completed.data.partner1Name).toBe("Rani");
      expect(completed.data.city).toBe("Bandung");
      expect(completed.data.locale).toBe("en");
    }
  });

  it("stubGetDraft mengembalikan null untuk id tak dikenal", () => {
    expect(stubGetDraft("tidak-ada")).toBeNull();
  });
});
