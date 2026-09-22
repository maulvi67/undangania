import { describe, expect, it } from "vitest";
import { invitationViewModelSchema } from "@wedding/template-engine";
import { getPublicInvitationFixture } from "./fixtures";
import { resolvePublicMedia, type PublicMediaPorts } from "./server";

describe("resolvePublicMedia", () => {
  it("resolves only scoped ready assets with short-lived read URLs", async () => {
    const model = invitationViewModelSchema.parse(
      getPublicInvitationFixture("normal"),
    );
    const ids = model.sections.flatMap(
      (section) => section.payload.assetIds ?? [],
    );
    const calls: { objectKey: string; expiresInSeconds: number }[] = [];
    const ports: PublicMediaPorts = {
      media: {
        findReadyByIds: async (scope, requestedIds) => {
          expect(scope).toEqual({
            tenantId: "tenant-1",
            weddingId: "wedding-1",
          });
          expect(requestedIds).toEqual([...new Set(ids)]);
          return [
            {
              id: ids[0] ?? "asset-1",
              tenantId: "tenant-1",
              weddingId: "wedding-1",
              objectKey: "tenant-1/wedding-1/media/one.jpg",
              mediaType: "IMAGE",
              state: "READY",
              mimeType: "image/jpeg",
              sizeBytes: 100,
              checksum: "etag-1",
              width: null,
              height: null,
              altText: "Foto yang siap",
              rejectionReason: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        },
      },
      storage: {
        createReadUrl: async (objectKey, expiresInSeconds) => {
          calls.push({ objectKey, expiresInSeconds });
          return "https://signed.example.test/read/one";
        },
      },
    };

    const result = await resolvePublicMedia(
      {
        slug: "rani-bima",
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        templateId: "seruni-klasik",
        templateVersion: "1",
        contractVersion: 1,
        invitationStatus: "PUBLISHED",
        snapshot: model,
      },
      model,
      ports,
    );

    expect(result).toEqual([
      {
        assetId: ids[0],
        url: "https://signed.example.test/read/one",
        mimeType: "image/jpeg",
        altText: "Foto yang siap",
      },
    ]);
    expect(calls).toEqual([
      {
        objectKey: "tenant-1/wedding-1/media/one.jpg",
        expiresInSeconds: 300,
      },
    ]);
    expect(JSON.stringify(model)).not.toContain("signed.example.test");
  });

  it("keeps signed media in the immutable snapshot order", async () => {
    const model = invitationViewModelSchema.parse(
      getPublicInvitationFixture("normal"),
    );
    const gallery = model.sections.find(
      (section) => section.type === "gallery",
    );
    if (!gallery?.payload.assetIds) throw new Error("Expected gallery assets");
    const ids = gallery.payload.assetIds;
    const ports: PublicMediaPorts = {
      media: {
        findReadyByIds: async () =>
          [...ids].reverse().map((id, index) => ({
            id,
            tenantId: "tenant-1",
            weddingId: "wedding-1",
            objectKey: `tenant-1/wedding-1/media/${index}.jpg`,
            mediaType: "IMAGE" as const,
            state: "READY" as const,
            mimeType: "image/jpeg",
            sizeBytes: 100,
            checksum: `etag-${index}`,
            width: null,
            height: null,
            altText: null,
            rejectionReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
      },
      storage: {
        createReadUrl: async (objectKey) => `https://signed.test/${objectKey}`,
      },
    };

    const result = await resolvePublicMedia(
      {
        slug: "rani-bima",
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        templateId: "seruni-klasik",
        templateVersion: "1",
        contractVersion: 1,
        invitationStatus: "PUBLISHED",
        snapshot: model,
      },
      model,
      ports,
    );
    expect(result.map((asset) => asset.assetId)).toEqual(ids);
  });

  it("omits rejected, deleted, mismatched, and missing assets because the repository controls readiness", async () => {
    const model = invitationViewModelSchema.parse(
      getPublicInvitationFixture("normal"),
    );
    const ports: PublicMediaPorts = {
      media: {
        findReadyByIds: async () => [],
      },
      storage: {
        createReadUrl: async () => {
          throw new Error("must not sign an unresolved asset");
        },
      },
    };

    await expect(
      resolvePublicMedia(
        {
          slug: "rani-bima",
          tenantId: "tenant-1",
          weddingId: "wedding-1",
          templateId: "seruni-klasik",
          templateVersion: "1",
          contractVersion: 1,
          invitationStatus: "PUBLISHED",
          snapshot: model,
        },
        model,
        ports,
      ),
    ).resolves.toEqual([]);
  });
});
