import { describe, expect, it } from "vitest";
import { getPrismaClient, prisma } from "./client";

describe("Prisma client singleton", () => {
  it("returns the same server client instance", () => {
    expect(getPrismaClient()).toBe(prisma);
  });
});
