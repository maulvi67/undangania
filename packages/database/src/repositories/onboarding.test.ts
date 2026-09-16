import { describe, expect, it, vi } from "vitest";

import {
  combineEventStartsAt,
  fromYmd,
  PrismaOnboardingRepository,
  toContractLocale,
  toDbLocale,
  toYmd,
  type OnboardingDataDto,
  type OnboardingRepositoryClient,
} from "./onboarding";

const SCOPE = {
  tenantId: "tenant-1",
  weddingId: "wedding-1",
  actorId: "user-1",
} as const;

const weddingRow = {
  id: "wedding-1",
  tenantId: "tenant-1",
  partner1Name: "Ani",
  partner2Name: "Budi",
  weddingDate: new Date("2026-09-15T00:00:00.000Z"),
  weddingDateUndecided: false,
  city: "Bandung",
  timezone: "Asia/Jakarta",
  locale: "id-ID",
  status: "DRAFT",
  version: 3,
  onboardingCompletedAt: null,
};

const eventRow = {
  id: "event-1",
  tenantId: "tenant-1",
  weddingId: "wedding-1",
  title: "Akad Nikah",
  eventType: "Akad Nikah",
  startsAt: new Date("2026-09-15T09:30:00.000Z"),
  timezone: "Asia/Jakarta",
  venueName: "Masjid Raya",
  addressSnapshot: "Jl. Merdeka 1",
  displayOrder: 0,
};

type WeddingDelegate = OnboardingRepositoryClient["wedding"];
type EventDelegate = OnboardingRepositoryClient["weddingEvent"];

function weddingDelegate(
  input: {
    findFirst?: WeddingDelegate["findFirst"];
    updateMany?: WeddingDelegate["updateMany"];
  } = {},
): WeddingDelegate {
  return {
    findFirst: input.findFirst ?? vi.fn().mockResolvedValue(weddingRow),
    updateMany: input.updateMany ?? vi.fn().mockResolvedValue({ count: 1 }),
  };
}

function eventDelegate(
  input: {
    findFirst?: EventDelegate["findFirst"];
    updateMany?: EventDelegate["updateMany"];
    create?: EventDelegate["create"];
  } = {},
): EventDelegate {
  return {
    findFirst: input.findFirst ?? vi.fn().mockResolvedValue(null),
    updateMany: input.updateMany ?? vi.fn().mockResolvedValue({ count: 1 }),
    create: input.create ?? vi.fn().mockResolvedValue({ id: "event-1" }),
  };
}

const fullData: OnboardingDataDto = {
  partner1Name: "Ani",
  partner2Name: "Budi",
  weddingDate: "2026-09-15",
  weddingDateUndecided: false,
  eventType: "Akad Nikah",
  eventDate: "2026-09-15",
  eventTime: "09:30",
  city: "Bandung",
  timezone: "Asia/Jakarta",
  venueName: "Masjid Raya",
  venueAddress: "Jl. Merdeka 1",
  locale: "id",
};

describe("toYmd", () => {
  it("reads the UTC calendar day, not the server's local day", () => {
    expect(toYmd(new Date("2026-09-15T00:00:00.000Z"))).toBe("2026-09-15");
    expect(toYmd(new Date("2026-01-05T23:59:59.000Z"))).toBe("2026-01-05");
    expect(toYmd(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
  });

  it("returns an empty string for a missing or invalid date", () => {
    expect(toYmd(null)).toBe("");
    expect(toYmd(new Date("not-a-date"))).toBe("");
  });
});

describe("fromYmd", () => {
  it("parses a day to UTC midnight so no local zone can shift it", () => {
    const parsed = fromYmd("2026-09-15");

    expect(parsed?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(parsed?.getUTCHours()).toBe(0);
    expect(parsed?.getUTCMinutes()).toBe(0);
  });

  it("round-trips with toYmd", () => {
    for (const ymd of [
      "2026-09-15",
      "2024-02-29",
      "2030-12-31",
      "2026-01-01",
    ]) {
      expect(toYmd(fromYmd(ymd))).toBe(ymd);
    }
  });

  it("returns null rather than a shifted day for input it cannot trust", () => {
    expect(fromYmd("")).toBeNull();
    expect(fromYmd("   ")).toBeNull();
    expect(fromYmd("2026-9-15")).toBeNull();
    expect(fromYmd("15/09/2026")).toBeNull();
    expect(fromYmd("2026-09-15T00:00:00.000Z")).toBeNull();
    // A shape-valid but non-existent day must not roll forward into March.
    expect(fromYmd("2026-02-30")).toBeNull();
    expect(fromYmd("2026-13-01")).toBeNull();
  });

  it("tolerates surrounding whitespace", () => {
    expect(toYmd(fromYmd(" 2026-09-15 "))).toBe("2026-09-15");
  });
});

describe("locale mapping", () => {
  it("maps database locales onto the contract's two values", () => {
    expect(toContractLocale("id-ID")).toBe("id");
    expect(toContractLocale("id")).toBe("id");
    expect(toContractLocale("en")).toBe("en");
    expect(toContractLocale("en-US")).toBe("en");
    expect(toContractLocale("EN")).toBe("en");
  });

  it("falls back to Indonesian for a value it does not recognise", () => {
    expect(toContractLocale("")).toBe("id");
    expect(toContractLocale("fr-FR")).toBe("id");
    expect(toContractLocale("id-ID-x-custom")).toBe("id");
  });

  it("round-trips in both directions", () => {
    expect(toDbLocale("id")).toBe("id-ID");
    expect(toDbLocale("en")).toBe("en");
    expect(toDbLocale(toContractLocale("id-ID"))).toBe("id-ID");
    expect(toDbLocale(toContractLocale("en"))).toBe("en");
    expect(toContractLocale(toDbLocale("id"))).toBe("id");
    expect(toContractLocale(toDbLocale("en"))).toBe("en");
  });
});

describe("combineEventStartsAt", () => {
  it("combines the wall-clock date and time into one instant", () => {
    expect(combineEventStartsAt("2026-09-15", "09:30")?.toISOString()).toBe(
      "2026-09-15T09:30:00.000Z",
    );
    expect(combineEventStartsAt("2026-09-15", "00:01")?.toISOString()).toBe(
      "2026-09-15T00:01:00.000Z",
    );
    expect(combineEventStartsAt("2026-09-15", "23:59")?.toISOString()).toBe(
      "2026-09-15T23:59:00.000Z",
    );
  });

  it("treats a blank time as midnight and endsAt as out of scope", () => {
    const midnight = combineEventStartsAt("2026-09-15", "");

    expect(midnight?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(combineEventStartsAt("2026-09-15", "   ")?.getTime()).toBe(
      midnight?.getTime(),
    );
    expect(combineEventStartsAt("2026-09-15", "00:00")?.getTime()).toBe(
      midnight?.getTime(),
    );
  });

  it("returns null when there is no usable start", () => {
    expect(combineEventStartsAt("", "09:30")).toBeNull();
    expect(combineEventStartsAt("", "")).toBeNull();
    expect(combineEventStartsAt("2026-02-30", "09:30")).toBeNull();
    expect(combineEventStartsAt("15/09/2026", "09:30")).toBeNull();
    expect(combineEventStartsAt("2026-09-15", "9:30")).toBeNull();
    expect(combineEventStartsAt("2026-09-15", "24:00")).toBeNull();
    expect(combineEventStartsAt("2026-09-15", "09:60")).toBeNull();
    expect(combineEventStartsAt("2026-09-15", "morning")).toBeNull();
  });
});

describe("PrismaOnboardingRepository.loadDraft", () => {
  it("scopes the lookup by tenant and returns null when the wedding is absent", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const eventFindFirst = vi.fn();
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({ findFirst }),
      weddingEvent: eventDelegate({ findFirst: eventFindFirst }),
    });

    await expect(repository.loadDraft(SCOPE)).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "wedding-1", tenantId: "tenant-1" },
      select: expect.objectContaining({
        id: true,
        version: true,
        locale: true,
        onboardingCompletedAt: true,
      }),
    });
    expect(eventFindFirst).not.toHaveBeenCalled();
  });

  it("scopes the first-event lookup through the parent wedding too", async () => {
    const eventFindFirst = vi.fn().mockResolvedValue(eventRow);
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate(),
      weddingEvent: eventDelegate({ findFirst: eventFindFirst }),
    });

    await repository.loadDraft(SCOPE);

    expect(eventFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        wedding: { tenantId: "tenant-1" },
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: expect.objectContaining({
        id: true,
        eventType: true,
        startsAt: true,
      }),
    });
  });

  it("reconstructs the wizard payload from the wedding and its first event", async () => {
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate(),
      weddingEvent: eventDelegate({
        findFirst: vi.fn().mockResolvedValue(eventRow),
      }),
    });

    await expect(repository.loadDraft(SCOPE)).resolves.toEqual({
      weddingId: "wedding-1",
      version: 3,
      completed: false,
      firstEventId: "event-1",
      data: {
        partner1Name: "Ani",
        partner2Name: "Budi",
        weddingDate: "2026-09-15",
        weddingDateUndecided: false,
        eventType: "Akad Nikah",
        eventDate: "2026-09-15",
        eventTime: "09:30",
        city: "Bandung",
        timezone: "Asia/Jakarta",
        venueName: "Masjid Raya",
        venueAddress: "Jl. Merdeka 1",
        locale: "id",
      },
    });
  });

  it("round-trips an English locale and reports a completed draft", async () => {
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({
        findFirst: vi.fn().mockResolvedValue({
          ...weddingRow,
          locale: "en",
          status: "READY",
          onboardingCompletedAt: new Date("2026-09-16T04:00:00.000Z"),
        }),
      }),
      weddingEvent: eventDelegate({
        findFirst: vi.fn().mockResolvedValue(eventRow),
      }),
    });

    const draft = await repository.loadDraft(SCOPE);

    expect(draft?.data.locale).toBe("en");
    expect(draft?.completed).toBe(true);
  });

  it("reports blank event fields when the wedding has no event yet", async () => {
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({
        findFirst: vi.fn().mockResolvedValue({
          ...weddingRow,
          partner1Name: null,
          partner2Name: null,
          weddingDate: null,
          city: null,
        }),
      }),
      weddingEvent: eventDelegate(),
    });

    const draft = await repository.loadDraft(SCOPE);

    expect(draft?.firstEventId).toBeNull();
    expect(draft?.data).toEqual({
      partner1Name: "",
      partner2Name: "",
      weddingDate: "",
      weddingDateUndecided: false,
      eventType: "",
      eventDate: "",
      eventTime: "",
      city: "",
      timezone: "Asia/Jakarta",
      venueName: "",
      venueAddress: "",
      locale: "id",
    });
  });
});

describe("PrismaOnboardingRepository.saveStep", () => {
  it("guards the couple write with the base version and increments it", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({ updateMany }),
      weddingEvent: eventDelegate(),
    });

    await expect(
      repository.saveStep(SCOPE, {
        step: 1,
        data: {
          partner1Name: "Ani",
          partner2Name: "Budi",
          weddingDate: "2026-09-15",
          weddingDateUndecided: false,
        },
        baseVersion: 3,
      }),
    ).resolves.toEqual({ ok: true, version: 4 });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "wedding-1",
        tenantId: "tenant-1",
        version: 3,
      },
      data: {
        partner1Name: "Ani",
        partner2Name: "Budi",
        weddingDate: new Date("2026-09-15T00:00:00.000Z"),
        weddingDateUndecided: false,
        version: { increment: 1 },
      },
    });
  });

  it("stores blank text as null and a blank date as an unresolved choice", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({ updateMany }),
      weddingEvent: eventDelegate(),
    });

    await repository.saveStep(SCOPE, {
      step: 1,
      data: { partner1Name: "", partner2Name: "", weddingDate: "" },
      baseVersion: 3,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "wedding-1", tenantId: "tenant-1", version: 3 },
      data: {
        partner1Name: null,
        partner2Name: null,
        weddingDate: null,
        version: { increment: 1 },
      },
    });
  });

  it("writes only the requested fields, so untouched steps survive", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({ updateMany }),
      weddingEvent: eventDelegate(),
    });

    await repository.saveStep(SCOPE, {
      step: 3,
      data: { timezone: "Asia/Makassar", locale: "en" },
      baseVersion: 11,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "wedding-1", tenantId: "tenant-1", version: 11 },
      data: {
        timezone: "Asia/Makassar",
        locale: "en",
        version: { increment: 1 },
      },
    });
  });

  it("reports STALE with the version the client lost to, and writes nothing else", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn();
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(weddingRow)
      .mockResolvedValueOnce({ ...weddingRow, version: 9 });
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({ findFirst, updateMany }),
      weddingEvent: eventDelegate({ create }),
    });

    await expect(
      repository.saveStep(SCOPE, {
        step: 1,
        data: { partner1Name: "Ani" },
        baseVersion: 3,
      }),
    ).resolves.toEqual({ ok: false, reason: "STALE", currentVersion: 9 });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "wedding-1", tenantId: "tenant-1", version: 3 },
      data: { partner1Name: "Ani", version: { increment: 1 } },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a cross-tenant wedding and performs no write", async () => {
    const updateMany = vi.fn();
    const create = vi.fn();
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany,
      }),
      weddingEvent: eventDelegate({ create }),
    });

    await expect(
      repository.saveStep(
        { tenantId: "tenant-2", weddingId: "wedding-1", actorId: "user-2" },
        { step: 1, data: { partner1Name: "Ani" }, baseVersion: 3 },
      ),
    ).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });

    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("writes the city and upserts the first event at displayOrder 0 on step 2", async () => {
    const weddingUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: "event-1" });
    const eventUpdateMany = vi.fn();
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({ updateMany: weddingUpdateMany }),
      weddingEvent: eventDelegate({
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: eventUpdateMany,
        create,
      }),
    });

    await expect(
      repository.saveStep(SCOPE, {
        step: 2,
        data: {
          eventType: "Resepsi",
          eventDate: "2026-09-16",
          eventTime: "18:00",
          city: "Bandung",
          timezone: "Asia/Jakarta",
          venueName: "Gedung Merdeka",
          venueAddress: "Jl. Asia Afrika 1",
        },
        baseVersion: 4,
      }),
    ).resolves.toEqual({ ok: true, version: 5 });

    expect(weddingUpdateMany).toHaveBeenCalledWith({
      where: { id: "wedding-1", tenantId: "tenant-1", version: 4 },
      data: { city: "Bandung", version: { increment: 1 } },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        title: "Resepsi",
        eventType: "Resepsi",
        startsAt: new Date("2026-09-16T18:00:00.000Z"),
        timezone: "Asia/Jakarta",
        venueName: "Gedung Merdeka",
        addressSnapshot: "Jl. Asia Afrika 1",
        displayOrder: 0,
      },
      select: { id: true },
    });
    expect(eventUpdateMany).not.toHaveBeenCalled();
  });

  it("updates the existing first event instead of creating a second one", async () => {
    const eventUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn();
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate(),
      weddingEvent: eventDelegate({
        findFirst: vi.fn().mockResolvedValue(eventRow),
        updateMany: eventUpdateMany,
        create,
      }),
    });

    await expect(
      repository.saveStep(SCOPE, {
        step: 2,
        data: {
          eventType: "Akad Nikah",
          eventDate: "2026-09-15",
          eventTime: "10:00",
          city: "Bandung",
        },
        baseVersion: 3,
      }),
    ).resolves.toEqual({ ok: true, version: 4 });

    expect(eventUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "event-1",
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        wedding: { tenantId: "tenant-1" },
      },
      data: {
        startsAt: new Date("2026-09-15T10:00:00.000Z"),
        eventType: "Akad Nikah",
        title: "Akad Nikah",
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps a customised event title instead of re-deriving it from the type", async () => {
    const eventUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate(),
      weddingEvent: eventDelegate({
        findFirst: vi.fn().mockResolvedValue({
          ...eventRow,
          title: "Akad Nikah Ani & Budi",
        }),
        updateMany: eventUpdateMany,
      }),
    });

    await repository.saveStep(SCOPE, {
      step: 2,
      data: {
        eventType: "Resepsi",
        eventDate: "2026-09-15",
        eventTime: "10:00",
      },
      baseVersion: 3,
    });

    const call = eventUpdateMany.mock.calls[0]?.[0] as
      { data: Record<string, unknown> } | undefined;

    expect(call?.data).toEqual({
      startsAt: new Date("2026-09-15T10:00:00.000Z"),
      eventType: "Resepsi",
    });
  });

  it("does not invent an event when step 2 carries no usable date yet", async () => {
    const create = vi.fn();
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate(),
      weddingEvent: eventDelegate({
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      }),
    });

    await expect(
      repository.saveStep(SCOPE, {
        step: 2,
        data: {
          eventType: "Resepsi",
          eventDate: "",
          eventTime: "",
          city: "Bandung",
        },
        baseVersion: 3,
      }),
    ).resolves.toEqual({ ok: true, version: 4 });

    expect(create).not.toHaveBeenCalled();
  });

  it("runs the version-guarded write inside a transaction when one is available", async () => {
    let transactionCalls = 0;
    const base: OnboardingRepositoryClient = {
      wedding: weddingDelegate(),
      weddingEvent: eventDelegate(),
    };
    const repository = new PrismaOnboardingRepository({
      ...base,
      $transaction: <T>(
        work: (client: OnboardingRepositoryClient) => Promise<T>,
      ): Promise<T> => {
        transactionCalls += 1;
        return work(base);
      },
    });

    await expect(
      repository.saveStep(SCOPE, {
        step: 1,
        data: { partner1Name: "Ani" },
        baseVersion: 3,
      }),
    ).resolves.toEqual({ ok: true, version: 4 });

    expect(transactionCalls).toBe(1);
  });
});

describe("PrismaOnboardingRepository.complete", () => {
  it("seals the draft and writes every step in one transaction", async () => {
    const weddingUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const eventUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    let transactionCalls = 0;
    const base: OnboardingRepositoryClient = {
      wedding: weddingDelegate({ updateMany: weddingUpdateMany }),
      weddingEvent: eventDelegate({
        findFirst: vi.fn().mockResolvedValue(eventRow),
        updateMany: eventUpdateMany,
      }),
    };
    const repository = new PrismaOnboardingRepository({
      ...base,
      $transaction: <T>(
        work: (client: OnboardingRepositoryClient) => Promise<T>,
      ): Promise<T> => {
        transactionCalls += 1;
        return work(base);
      },
    });

    const result = await repository.complete(SCOPE, {
      data: fullData,
      baseVersion: 3,
    });

    expect(transactionCalls).toBe(1);
    expect(result).toEqual({ ok: true, version: 4, data: fullData });

    const weddingCall = weddingUpdateMany.mock.calls[0]?.[0] as
      | {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }
      | undefined;

    expect(weddingCall?.where).toEqual({
      id: "wedding-1",
      tenantId: "tenant-1",
      version: 3,
    });
    expect(weddingCall?.data).toEqual({
      partner1Name: "Ani",
      partner2Name: "Budi",
      weddingDate: new Date("2026-09-15T00:00:00.000Z"),
      weddingDateUndecided: false,
      city: "Bandung",
      timezone: "Asia/Jakarta",
      locale: "id-ID",
      status: "READY",
      onboardingCompletedAt: expect.any(Date),
      version: { increment: 1 },
    });

    expect(eventUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "event-1",
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        wedding: { tenantId: "tenant-1" },
      },
      data: {
        startsAt: new Date("2026-09-15T09:30:00.000Z"),
        eventType: "Akad Nikah",
        title: "Akad Nikah",
        timezone: "Asia/Jakarta",
        venueName: "Masjid Raya",
        addressSnapshot: "Jl. Merdeka 1",
      },
    });
  });

  it("creates the first event when completion is the first write that has one", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-1" });
    const base: OnboardingRepositoryClient = {
      wedding: weddingDelegate(),
      weddingEvent: eventDelegate({
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      }),
    };
    const repository = new PrismaOnboardingRepository({
      ...base,
      $transaction: <T>(
        work: (client: OnboardingRepositoryClient) => Promise<T>,
      ): Promise<T> => work(base),
    });

    await repository.complete(SCOPE, {
      data: { ...fullData, locale: "en" },
      baseVersion: 3,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        eventType: "Akad Nikah",
        startsAt: new Date("2026-09-15T09:30:00.000Z"),
        displayOrder: 0,
      }),
      select: { id: true },
    });
  });

  it("reports STALE instead of sealing a draft that moved", async () => {
    const weddingUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(weddingRow)
          .mockResolvedValueOnce({ ...weddingRow, version: 12 }),
        updateMany: weddingUpdateMany,
      }),
      weddingEvent: eventDelegate(),
    });

    await expect(
      repository.complete(SCOPE, { data: fullData, baseVersion: 3 }),
    ).resolves.toEqual({ ok: false, reason: "STALE", currentVersion: 12 });

    expect(weddingUpdateMany).toHaveBeenCalledWith({
      where: { id: "wedding-1", tenantId: "tenant-1", version: 3 },
      data: expect.objectContaining({ status: "READY" }),
    });
  });

  it("returns NOT_FOUND for a cross-tenant wedding and performs no write", async () => {
    const weddingUpdateMany = vi.fn();
    const repository = new PrismaOnboardingRepository({
      wedding: weddingDelegate({
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: weddingUpdateMany,
      }),
      weddingEvent: eventDelegate(),
    });

    await expect(
      repository.complete(
        { tenantId: "tenant-2", weddingId: "wedding-1", actorId: "user-2" },
        { data: fullData, baseVersion: 3 },
      ),
    ).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });

    expect(weddingUpdateMany).not.toHaveBeenCalled();
  });
});
