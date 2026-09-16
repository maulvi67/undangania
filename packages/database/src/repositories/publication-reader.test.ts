import { describe, expect, it, vi } from "vitest";
import {
  PrismaPublicationReaderRepository,
  isPublicSlug,
} from "./publication-reader";

function client(findFirst: ReturnType<typeof vi.fn>) {
  return { invitationPublication: { findFirst } };
}

describe("isPublicSlug", () => {
  it("accepts the shape the slug generator emits", () => {
    expect(isPublicSlug("rani-bima-1a2b3c4d")).toBe(true);
    expect(isPublicSlug("seruni-klasik")).toBe(true);
    expect(isPublicSlug("undangan-deadbeef")).toBe(true);
  });

  it("rejects anything that could not be a generated slug", () => {
    const rejected = [
      "",
      "-leading",
      "trailing-",
      "double--dash",
      "Upper-Case",
      "dot.dot",
      "slash/segment",
      "sp%20ace",
      "\\..\\..\\etc\\passwd",
      "a".repeat(101),
    ];
    for (const slug of rejected) {
      expect(isPublicSlug(slug)).toBe(false);
    }
  });
});

describe("PrismaPublicationReaderRepository", () => {
  it("reads only the active publication and returns the snapshot fields", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      snapshot: { schemaVersion: 1 },
      templateId: "seruni-klasik",
      templateVersion: "1",
      contractVersion: 1,
    });
    const repository = new PrismaPublicationReaderRepository(client(findFirst));

    await expect(
      repository.findActiveBySlug("rani-bima-1a2b3c4d"),
    ).resolves.toEqual({
      slug: "rani-bima-1a2b3c4d",
      templateId: "seruni-klasik",
      templateVersion: "1",
      contractVersion: 1,
      snapshot: { schemaVersion: 1 },
    });

    // `active: true` is what makes a draft unreachable from the public address,
    // and the select must not reach for tenant or invitation internals.
    expect(findFirst).toHaveBeenCalledWith({
      where: { active: true, invitation: { slug: "rani-bima-1a2b3c4d" } },
      select: {
        snapshot: true,
        templateId: true,
        templateVersion: true,
        contractVersion: true,
      },
    });
  });

  it("reports a missing or unpublished slug as null without querying", async () => {
    const findFirst = vi.fn();
    const repository = new PrismaPublicationReaderRepository(client(findFirst));

    await expect(repository.findActiveBySlug("../../etc/passwd")).resolves.toBe(
      null,
    );
    await expect(repository.findActiveBySlug("")).resolves.toBe(null);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("reports an unpublished slug as null", async () => {
    const repository = new PrismaPublicationReaderRepository(
      client(vi.fn().mockResolvedValue(null)),
    );

    await expect(
      repository.findActiveBySlug("rani-bima-1a2b3c4d"),
    ).resolves.toBe(null);
  });
});
