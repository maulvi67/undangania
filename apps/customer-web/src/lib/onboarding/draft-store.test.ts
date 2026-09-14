import { describe, expect, it } from "vitest";
import {
  DRAFT_STORAGE_KEY,
  browserStorage,
  clearStoredDraft,
  createDraftId,
  loadStoredDraft,
  parseStoredDraft,
  saveStoredDraft,
  type DraftStorage,
  type StoredDraft,
} from "./draft-store";
import { createInitialData, type OnboardingData } from "./contract";

class MemoryStorage implements DraftStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function makeDraft(overrides: {
  completed?: boolean;
  data?: OnboardingData;
  step?: 1 | 2 | 3;
  version?: number;
} = {}): StoredDraft {
  return {
    draftId: "draft-uji",
    step: overrides.step ?? 1,
    version: overrides.version ?? 2,
    updatedAt: 1_800_000_000_000,
    ...(overrides.completed === true ? { completed: true } : {}),
    data:
      overrides.data ??
      { ...createInitialData(), partner1Name: "Rani", partner2Name: "Bima", city: "Bandung" },
  };
}

describe("draft-store", () => {
  it("menyimpan dan memuat draf utuh (round-trip)", () => {
    const storage = new MemoryStorage();
    const draft = makeDraft();
    saveStoredDraft(draft, storage);
    expect(loadStoredDraft(storage)).toEqual(draft);
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toContain("draft-uji");
  });

  it("menolak JSON rusak dan bentuk yang tidak dikenal", () => {
    const storage = new MemoryStorage();
    storage.setItem(DRAFT_STORAGE_KEY, "{bukan json");
    expect(loadStoredDraft(storage)).toBeNull();

    const cases: Array<Record<string, unknown>> = [
      {},
      { draftId: "", step: 1, version: 1, updatedAt: 1, data: {} },
      { draftId: "x", step: 4, version: 1, updatedAt: 1, data: {} },
      { draftId: "x", step: 1, version: "1", updatedAt: 1, data: {} },
      { draftId: "x", step: 1, version: -1, updatedAt: 1, data: {} },
      { draftId: "x", step: 1, version: 1, updatedAt: "besok", data: {} },
      { draftId: "x", step: 1, version: 1, updatedAt: 1, data: null },
      { draftId: "x", step: 1, version: 1, updatedAt: 1, completed: "ya", data: {} },
      {
        draftId: "x",
        step: 1,
        version: 1,
        updatedAt: 1,
        data: { ...makeDraft().data, partner1Name: 42 },
      },
    ];
    for (const broken of cases) {
      expect(parseStoredDraft(JSON.stringify(broken))).toBeNull();
    }
  });

  it("memulihkan nilai enum/tanggal rusak ke default yang bisa dirender", () => {
    const raw = JSON.stringify({
      draftId: "x",
      step: 2,
      version: 1,
      updatedAt: 1,
      data: {
        ...makeDraft().data,
        eventType: "Seminar",
        timezone: "Asia/Mars",
        locale: "fr",
        weddingDate: "21/03/2026",
        eventDate: "bukan-tanggal",
        eventTime: "25:00",
      },
    });
    const parsed = parseStoredDraft(raw);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.step).toBe(2);
      expect(parsed.data.eventType).toBe("Akad Nikah");
      expect(parsed.data.timezone).toBe("Asia/Jakarta");
      expect(parsed.data.locale).toBe("id");
      expect(parsed.data.weddingDate).toBe("");
      expect(parsed.data.eventDate).toBe("");
      expect(parsed.data.eventTime).toBe("");
      // Isian valid tidak tersentuh.
      expect(parsed.data.partner1Name).toBe("Rani");
      expect(parsed.data.city).toBe("Bandung");
    }
  });

  it("menghapus draf dengan clear", () => {
    const storage = new MemoryStorage();
    saveStoredDraft(makeDraft(), storage);
    clearStoredDraft(storage);
    expect(loadStoredDraft(storage)).toBeNull();
  });

  it("penanda selesai ikut tersimpan dan terbaca kembali", () => {
    const storage = new MemoryStorage();
    saveStoredDraft(makeDraft({ completed: true, step: 3, version: 5 }), storage);
    const loaded = loadStoredDraft(storage);
    expect(loaded?.completed).toBe(true);
    expect(loaded?.step).toBe(3);
  });

  it("createDraftId menghasilkan id unik dan tidak kosong", () => {
    const first = createDraftId();
    const second = createDraftId();
    expect(first.length).toBeGreaterThan(8);
    expect(first).not.toBe(second);
  });

  it("lingkungan tanpa window: browserStorage null dan API tidak melempar", () => {
    expect(browserStorage()).toBeNull();
    expect(loadStoredDraft()).toBeNull();
    // Tidak boleh melempar walau storage tidak tersedia.
    saveStoredDraft(makeDraft(), null);
    clearStoredDraft(null);
  });
});
