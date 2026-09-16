import { describe, expect, it } from "vitest";
import { isJsonValue } from "./invitation-editor";

/**
 * The editor types draft bodies as `unknown`, and a JSON column is the only place
 * they are stored. This check is what stops a body that cannot round-trip from
 * failing deep inside Prisma, so its rejections matter as much as its acceptances.
 */
describe("isJsonValue", () => {
  it("accepts values a JSON column round-trips", () => {
    const accepted: unknown[] = [
      null,
      "text",
      0,
      -1.5,
      true,
      false,
      [],
      {},
      { couple: { partner1Name: "Rani" } },
      { events: [{ id: "akad", startsAt: "2026-09-12T08:00" }] },
      { gifts: [{ amount: null, visible: false }] },
    ];
    for (const value of accepted) {
      expect(isJsonValue(value)).toBe(true);
    }
  });

  it("rejects values a JSON column cannot hold", () => {
    const rejected: unknown[] = [
      undefined,
      () => "no",
      Symbol("no"),
      10n,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      new Date(),
      { when: new Date() },
      [new Date()],
    ];
    for (const value of rejected) {
      expect(isJsonValue(value)).toBe(false);
    }
  });

  it("rejects an object property that JSON would silently drop", () => {
    // `JSON.stringify({ a: undefined })` is `{}`, so accepting this would store
    // something different from what was written.
    expect(isJsonValue({ couple: { intro: undefined } })).toBe(false);
    expect(isJsonValue({ events: [undefined] })).toBe(false);
  });

  it("rejects a cycle rather than overflowing", () => {
    const cyclic: Record<string, unknown> = { id: "couple" };
    cyclic.self = cyclic;
    expect(isJsonValue(cyclic)).toBe(false);

    const selfArray: unknown[] = [];
    selfArray.push(selfArray);
    expect(isJsonValue(selfArray)).toBe(false);
  });

  it("accepts a value that is shared but not cyclic", () => {
    // The same object referenced twice serializes fine; only a cycle cannot.
    const shared = { visible: true };
    expect(isJsonValue({ story: shared, music: shared })).toBe(true);
  });
});
