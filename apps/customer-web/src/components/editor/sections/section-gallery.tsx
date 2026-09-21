import { useState } from "react";
import { Alert, Button, Input } from "@wedding/ui";
import type {
  EditorContent,
  EditorMediaAsset,
} from "../../../lib/editor/contract";
import { removeMediaAssetAction } from "../../../lib/media/actions";
import type { EditorPatch } from "../editor-form";
import { UploadState } from "../upload-state";

function updateAsset(
  assets: EditorContent["media"],
  id: string,
  patch: Partial<EditorMediaAsset>,
): EditorContent["media"] {
  return assets.map((asset) =>
    asset.id === id ? { ...asset, ...patch } : asset,
  );
}

export function SectionGallery({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const imageIds = content.media
    .filter((asset) => asset.mediaType === "IMAGE" && asset.state !== "DELETED")
    .map((asset) => asset.id);
  const orderedIds = [
    ...content.galleryAssetIds.filter((id) => imageIds.includes(id)),
    ...imageIds.filter((id) => !content.galleryAssetIds.includes(id)),
  ];
  const images = orderedIds.flatMap((id) => {
    const asset = content.media.find((candidate) => candidate.id === id);
    return asset === undefined ? [] : [asset];
  });
  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedIds.length) return;
    const next = [...orderedIds];
    const current = next[index];
    const target = next[targetIndex];
    if (current === undefined || target === undefined) return;
    next[index] = target;
    next[targetIndex] = current;
    onChange({ galleryAssetIds: next });
  };
  const handleDelete = async (asset: EditorMediaAsset) => {
    setError(null);
    const persisted =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        asset.id,
      );
    if (!persisted) {
      onChange({
        media: updateAsset(content.media, asset.id, { state: "DELETED" }),
      });
      return;
    }
    const outcome = await removeMediaAssetAction({ assetId: asset.id });
    if (outcome.kind === "ok" || outcome.kind === "not-found") {
      onChange({
        media: updateAsset(content.media, asset.id, { state: "DELETED" }),
      });
      return;
    }
    setError(
      outcome.kind === "invalid" || outcome.kind === "provider-unavailable"
        ? outcome.message
        : "Media tidak dapat dihapus. Silakan coba lagi.",
    );
  };

  return (
    <div className="ed-section-content">
      <p className="ed-form-note">
        Galeri memakai media yang diunggah dari bagian Sampul. Tambahkan teks
        alternatif agar foto tetap bermakna bagi tamu yang memakai pembaca
        layar.
      </p>
      {error ? (
        <Alert variant="error" title="Media belum dapat dihapus">
          {error}
        </Alert>
      ) : null}
      {images.length === 0 ? (
        <p className="ed-inline-note">
          Belum ada foto yang dapat dipakai di galeri.
        </p>
      ) : (
        <p className="ed-form-note">
          Urutan ini tersimpan di draf dan akan dipakai pada undangan yang
          diterbitkan.
        </p>
      )}
      <div className="ed-repeatable-list">
        {images.map((asset) => (
          <fieldset className="ed-media-card" key={asset.id}>
            <legend className="ed-repeatable-card__legend">
              {asset.filename}
            </legend>
            <UploadState
              state={asset.state}
              rejectionReason={asset.rejectionReason}
            />
            <Input
              id={`editor-gallery-alt-${asset.id}`}
              label="Teks alternatif"
              hint="Deskripsikan isi foto secara singkat."
              value={asset.altText ?? ""}
              onChange={(event) =>
                onChange({
                  media: updateAsset(content.media, asset.id, {
                    altText: event.currentTarget.value || null,
                  }),
                })
              }
            />
            <div className="ed-order-item__actions">
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={() => move(images.indexOf(asset), -1)}
                disabled={images.indexOf(asset) === 0}
              >
                Naik
              </Button>
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={() => move(images.indexOf(asset), 1)}
                disabled={images.indexOf(asset) === images.length - 1}
              >
                Turun
              </Button>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => void handleDelete(asset)}
            >
              Hapus dari undangan
            </Button>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
