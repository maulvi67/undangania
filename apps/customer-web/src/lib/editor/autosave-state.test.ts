import { describe, expect, it } from "vitest";
import { reduceAutosaveState } from "./autosave-state";

describe("editor autosave state", () => {
  it("moves a changed draft through saving to saved", () => {
    expect(reduceAutosaveState("saved", { type: "CHANGE" })).toBe("dirty");
    expect(reduceAutosaveState("dirty", { type: "SAVE_START" })).toBe("saving");
    expect(reduceAutosaveState("saving", { type: "SAVE_SUCCESS" })).toBe(
      "saved",
    );
  });

  it("retries every transient save failure", () => {
    expect(reduceAutosaveState("save-failed", { type: "RETRY" })).toBe("dirty");
    expect(reduceAutosaveState("offline", { type: "RETRY" })).toBe("dirty");
    expect(reduceAutosaveState("provider-unavailable", { type: "RETRY" })).toBe(
      "dirty",
    );
    expect(reduceAutosaveState("stale-version", { type: "RETRY" })).toBe(
      "stale-version",
    );
  });

  it("keeps failures explicit", () => {
    expect(reduceAutosaveState("saving", { type: "SAVE_FAILED" })).toBe(
      "save-failed",
    );
    expect(reduceAutosaveState("saving", { type: "OFFLINE" })).toBe("offline");
    expect(reduceAutosaveState("saving", { type: "STALE_VERSION" })).toBe(
      "stale-version",
    );
  });
});
