import type { EditorSaveState } from "./contract";

export type AutosaveEvent =
  | { type: "LOAD_SUCCESS" }
  | { type: "CHANGE" }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_FAILED" }
  | { type: "OFFLINE" }
  | { type: "STALE_VERSION" }
  | { type: "INVALID_SECTION" }
  | { type: "PROVIDER_UNAVAILABLE" }
  | { type: "ENTITLEMENT_LIMIT_REACHED" }
  | { type: "UNAUTHORIZED" }
  | { type: "LOCKED" }
  | { type: "UPLOAD_PROCESSING" }
  | { type: "UPLOAD_REJECTED" }
  | { type: "RETRY" };

export function reduceAutosaveState(
  state: EditorSaveState,
  event: AutosaveEvent,
): EditorSaveState {
  switch (event.type) {
    case "LOAD_SUCCESS":
      return "saved";
    case "CHANGE":
      return "dirty";
    case "SAVE_START":
      return "saving";
    case "SAVE_SUCCESS":
      return "saved";
    case "SAVE_FAILED":
      return "save-failed";
    case "OFFLINE":
      return "offline";
    case "STALE_VERSION":
      return "stale-version";
    case "INVALID_SECTION":
      return "invalid-section";
    case "PROVIDER_UNAVAILABLE":
      return "provider-unavailable";
    case "ENTITLEMENT_LIMIT_REACHED":
      return "entitlement-limit-reached";
    case "UNAUTHORIZED":
      return "unauthorized";
    case "LOCKED":
      return "locked";
    case "UPLOAD_PROCESSING":
      return "upload-processing";
    case "UPLOAD_REJECTED":
      return "upload-rejected";
    case "RETRY":
      return state === "saved" ? "dirty" : state;
  }
}

export function isBlockingSaveState(state: EditorSaveState): boolean {
  return [
    "stale-version",
    "provider-unavailable",
    "entitlement-limit-reached",
    "locked",
    "unauthorized",
  ].includes(state);
}
