import { describe, expect, it } from "vitest";
import { nextMediaState, preflightUpload } from "./media-contract";

describe("editor media contract", () => {
  it("accepts supported images and rejects unsupported formats", () => {
    expect(
      preflightUpload({ name: "foto.webp", type: "image/webp", size: 1000 }),
    ).toEqual({ ok: true, mediaType: "IMAGE" });
    expect(
      preflightUpload({
        name: "script.js",
        type: "application/javascript",
        size: 1000,
      }).ok,
    ).toBe(false);
  });

  it("models asynchronous processing", () => {
    expect(nextMediaState("PENDING_UPLOAD", "uploaded")).toBe("UPLOADED");
    expect(nextMediaState("UPLOADED", "scan")).toBe("SCANNING");
    expect(nextMediaState("SCANNING", "process")).toBe("PROCESSING");
    expect(nextMediaState("PROCESSING", "ready")).toBe("READY");
  });
});
