import { useRef } from "react";
import { Alert, Button, Input } from "@wedding/ui";
import type {
  EditorContent,
  EditorMediaAsset,
  EditorMediaState,
} from "../../../lib/editor/contract";
import { preflightUpload } from "../../../lib/editor/media-contract";
import type { EditorPatch } from "../editor-form";
import { UploadState } from "../upload-state";

function mediaId(): string {
  return `media-${Date.now().toString(36)}`;
}

function updateAsset(
  assets: EditorContent["media"],
  id: string,
  patch: Partial<EditorMediaAsset>,
): EditorContent["media"] {
  return assets.map((asset) =>
    asset.id === id ? { ...asset, ...patch } : asset,
  );
}

export function SectionCover({
  content,
  onChange,
  onUploadState,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
  onUploadState: (state: EditorMediaState | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const images = content.media.filter(
    (asset) => asset.mediaType === "IMAGE" && asset.state !== "DELETED",
  );

  const handleFile = (file: File) => {
    const preflight = preflightUpload(file);
    const id = mediaId();
    if (!preflight.ok || preflight.mediaType !== "IMAGE") {
      const rejected: EditorMediaAsset = {
        id,
        filename: file.name,
        mediaType: "IMAGE",
        mimeType: file.type || "application/octet-stream",
        state: "REJECTED",
        sizeBytes: file.size,
        width: null,
        height: null,
        altText: null,
        rejectionReason: preflight.ok
          ? "Jenis media ini hanya dapat digunakan di bagian musik."
          : preflight.reason,
      };
      onChange((current) => ({ media: [...current.media, rejected] }));
      onUploadState("REJECTED");
      return;
    }
    const asset: EditorMediaAsset = {
      id,
      filename: file.name,
      mediaType: "IMAGE",
      mimeType: file.type,
      state: "PROCESSING",
      sizeBytes: file.size,
      width: null,
      height: null,
      altText: null,
      rejectionReason: null,
    };
    onChange((current) => ({ media: [...current.media, asset] }));
    onUploadState("PROCESSING");
    window.setTimeout(() => {
      onChange((current) => ({
        media: updateAsset(current.media, id, { state: "READY" }),
      }));
      onUploadState("READY");
    }, 700);
  };

  return (
    <div className="ed-section-content">
      <p className="ed-form-note">
        Format yang didukung: JPG, PNG, atau WebP. Ukuran maksimal 10 MB per
        gambar. Pada implementasi produksi, unggah harus melalui URL bertanda
        tangan dan pemeriksaan provider.
      </p>
      <div className="ed-upload-box">
        <label className="ed-upload-box__label" htmlFor="editor-cover-file">
          Tambah foto sampul
        </label>
        <input
          ref={inputRef}
          id="editor-cover-file"
          className="ed-upload-box__input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) handleFile(file);
            event.currentTarget.value = "";
          }}
        />
        <p className="ed-upload-box__hint">
          Pilih satu foto dari perangkat Anda. Preview lokal ini tidak
          mengunggah ke layanan nyata.
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
        >
          Pilih file
        </Button>
      </div>
      {images.some((asset) => asset.state === "REJECTED") ? (
        <Alert variant="error" title="Ada media yang perlu diperiksa">
          Hapus media yang ditolak atau pilih file baru sebelum publikasi.
        </Alert>
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
              id={`editor-cover-alt-${asset.id}`}
              label="Teks alternatif"
              hint="Contoh: Pasangan tersenyum di taman."
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
              Hapus media
            </Button>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
