import { Button, Badge } from "@wedding/ui";
import { statusLabel, type EditorSaveState } from "../../lib/editor/contract";

const toneByState: Partial<
  Record<EditorSaveState, "neutral" | "olive" | "gold" | "blush">
> = {
  saved: "olive",
  saving: "gold",
  dirty: "gold",
  "save-failed": "blush",
  offline: "blush",
  "stale-version": "blush",
  "invalid-section": "blush",
  "upload-processing": "gold",
  "upload-rejected": "blush",
  "provider-unavailable": "blush",
  "entitlement-limit-reached": "blush",
  locked: "neutral",
  unauthorized: "blush",
};

export function SaveStatus({
  state,
  onRetry,
}: {
  state: EditorSaveState;
  onRetry: () => void;
}) {
  const retryable =
    state === "save-failed" ||
    state === "offline" ||
    state === "provider-unavailable";
  return (
    <div className="ed-save-status" aria-live="polite">
      <Badge tone={toneByState[state] ?? "neutral"}>{statusLabel(state)}</Badge>
      {retryable ? (
        <Button variant="tertiary" size="sm" onClick={onRetry}>
          Coba simpan lagi
        </Button>
      ) : null}
    </div>
  );
}
