import { Button, Input } from "@wedding/ui";
import type {
  EditorContent,
  EditorMediaAsset,
} from "../../../lib/editor/contract";
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
  const images = content.media.filter(
    (asset) => asset.mediaType === "IMAGE" && asset.state !== "DELETED",
  );
  return (
    <div className="ed-section-content">
      <p className="ed-form-note">
        Galeri memakai media yang diunggah dari bagian Sampul. Tambahkan teks
        alternatif agar foto tetap bermakna bagi tamu yang memakai pembaca
        layar.
      </p>
      {images.length === 0 ? (
        <p className="ed-inline-note">
          Belum ada foto yang dapat dipakai di galeri.
        </p>
      ) : null}
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
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() =>
                onChange({
                  media: updateAsset(content.media, asset.id, {
                    state: "DELETED",
                  }),
                })
              }
            >
              Hapus dari undangan
            </Button>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
