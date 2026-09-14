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
