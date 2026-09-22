import type { MediaListAsset, MediaListOutcome } from "../media/outcomes";
import type {
  EditorContent,
  EditorMediaAsset,
  EditorMediaState,
} from "./contract";

export type MediaReconciliationResult = Readonly<{
  content: EditorContent;
  changed: boolean;
}>;

function sameLifecycleState(
  left: EditorMediaAsset,
  right: EditorMediaAsset,
): boolean {
  return (
    left.state === right.state &&
    left.width === right.width &&
    left.height === right.height &&
    left.rejectionReason === right.rejectionReason
  );
}

function reconcileAsset(
  asset: EditorMediaAsset,
  listed: MediaListAsset,
): EditorMediaAsset {
  if (asset.state === "DELETED") return asset;
  return {
    ...asset,
    state: listed.state,
    width: listed.width,
    height: listed.height,
    // Rejection reasons are not persisted by the current schema. Preserve a
    // local reason when the list endpoint cannot provide one.
    rejectionReason: listed.rejectionReason ?? asset.rejectionReason,
  };
}

export function reconcileMediaAssets(
  content: EditorContent,
  outcome: MediaListOutcome,
): MediaReconciliationResult {
  if (outcome.kind !== "ok") {
    return { content, changed: false };
  }

  const listedById = new Map(outcome.assets.map((asset) => [asset.id, asset]));
  let changed = false;
  const media = content.media.map((asset) => {
    const listed = listedById.get(asset.id);
    if (listed === undefined) return asset;
    const next = reconcileAsset(asset, listed);
    if (!sameLifecycleState(asset, next)) changed = true;
    return next;
  });

  return {
    content: changed ? { ...content, media } : content,
    changed,
  };
}

export function hasPendingMedia(content: EditorContent): boolean {
  return content.media.some(
    (asset) =>
      asset.state === "PENDING_UPLOAD" ||
      asset.state === "UPLOADED" ||
      asset.state === "SCANNING" ||
      asset.state === "PROCESSING",
  );
}

export function mediaStateForContent(
  content: EditorContent,
): EditorMediaState | null {
  const priority: readonly EditorMediaState[] = [
    "REJECTED",
    "PROCESSING",
    "SCANNING",
    "UPLOADED",
    "PENDING_UPLOAD",
    "READY",
  ];
  const states = new Set(
    content.media
      .filter((asset) => asset.state !== "DELETED")
      .map((asset) => asset.state),
  );
  return priority.find((state) => states.has(state)) ?? null;
}
