"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Input } from "@wedding/ui";
import type {
  EditorContent,
  EditorMediaAsset,
  EditorMediaState,
} from "../../../lib/editor/contract";
import { preflightUpload } from "../../../lib/editor/media-contract";
import {
  beginMediaUploadAction,
  completeMediaUploadAction,
  removeMediaAssetAction,
} from "../../../lib/media/actions";
import type { MediaActionOutcome } from "../../../lib/media/outcomes";
import type { EditorPatch } from "../editor-form";
import { UploadState } from "../upload-state";

function localMediaId(): string {
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

function isPersistedMediaId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function outcomeMessage(outcome: MediaActionOutcome): string | null {
  if (outcome.kind === "invalid" || outcome.kind === "rejected")
    return outcome.message;
  if (outcome.kind === "provider-unavailable") return outcome.message;
  if (outcome.kind === "forbidden")
    return "Sesi Anda tidak memiliki akses untuk mengelola media ini.";
  if (outcome.kind === "not-found") return "Media tidak ditemukan.";
  if (outcome.kind === "unavailable")
    return "Media belum dapat diproses. Silakan coba lagi.";
  return null;
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
  const mountedRef = useRef(true);
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const images = content.media.filter(
    (asset) => asset.mediaType === "IMAGE" && asset.state !== "DELETED",
  );
  const reportUploadState = (state: EditorMediaState | null) => {
    if (mountedRef.current) onUploadState(state);
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const addRejectedAsset = (file: File, reason: string) => {
    if (!mountedRef.current) return;
    const rejected: EditorMediaAsset = {
      id: localMediaId(),
      filename: file.name,
      mediaType: "IMAGE",
      mimeType: file.type || "application/octet-stream",
      state: "REJECTED",
      sizeBytes: file.size,
      width: null,
      height: null,
      altText: null,
      rejectionReason: reason,
    };
    onChange((current) => ({ media: [...current.media, rejected] }));
    reportUploadState("REJECTED");
  };

  const updateIfMounted = (id: string, patch: Partial<EditorMediaAsset>) => {
    if (!mountedRef.current) return;
    onChange((current) => ({ media: updateAsset(current.media, id, patch) }));
  };

  const handleFile = async (file: File) => {
    if (uploadingRef.current) return;
    setActionError(null);
    const preflight = preflightUpload(file);
    if (!preflight.ok || preflight.mediaType !== "IMAGE") {
      addRejectedAsset(
        file,
        preflight.ok
          ? "Jenis media ini hanya dapat digunakan di bagian musik."
          : preflight.reason,
      );
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    reportUploadState("PENDING_UPLOAD");
    let assetId: string | null = null;

    try {
      const begin = await beginMediaUploadAction({
        filename: file.name,
        mediaType: "IMAGE",
        mimeType: file.type,
        sizeBytes: file.size,
        altText: null,
      });
      if (begin.kind !== "ok" || begin.uploadUrl === undefined) {
        const message =
          outcomeMessage(begin) ?? "Unggahan tidak dapat dimulai.";
        if (begin.kind === "invalid" || begin.kind === "rejected") {
          addRejectedAsset(file, message);
        } else {
          if (mountedRef.current) setActionError(message);
          reportUploadState(null);
        }
        return;
      }

      assetId = begin.assetId;
      const asset: EditorMediaAsset = {
        id: assetId,
        filename: file.name,
        mediaType: "IMAGE",
        mimeType: file.type,
        state: "PENDING_UPLOAD",
        sizeBytes: file.size,
        width: null,
        height: null,
        altText: null,
        rejectionReason: null,
      };
      if (mountedRef.current) {
        onChange((current) => ({ media: [...current.media, asset] }));
      }

      const uploadResponse = await fetch(begin.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadResponse.ok) {
        throw new Error("File tidak dapat dikirim ke penyimpanan.");
      }

      updateIfMounted(assetId, { state: "UPLOADED" });
      reportUploadState("UPLOADED");
      const complete = await completeMediaUploadAction({ assetId });
      if (complete.kind === "ok") {
        updateIfMounted(assetId, {
          state: complete.state,
          rejectionReason: null,
        });
        reportUploadState(complete.state);
        return;
      }

      const message =
        outcomeMessage(complete) ?? "Media tidak dapat diverifikasi.";
      if (complete.kind !== "rejected") {
        updateIfMounted(assetId, {
          state: "UPLOADED",
          rejectionReason: null,
        });
        if (mountedRef.current) setActionError(message);
        reportUploadState("UPLOADED");
        return;
      }
      updateIfMounted(assetId, { state: "REJECTED", rejectionReason: message });
      reportUploadState("REJECTED");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unggahan media gagal. Silakan coba lagi.";
      if (assetId !== null) {
        updateIfMounted(assetId, {
          state: "DELETED",
          rejectionReason: null,
        });
        void removeMediaAssetAction({ assetId });
        if (mountedRef.current) setActionError(message);
        reportUploadState(null);
      } else {
        if (mountedRef.current) setActionError(message);
        reportUploadState(null);
      }
    } finally {
      uploadingRef.current = false;
      if (mountedRef.current) setUploading(false);
    }
  };

  const handleDelete = async (asset: EditorMediaAsset) => {
    setActionError(null);
    if (!isPersistedMediaId(asset.id)) {
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
    setActionError(outcomeMessage(outcome) ?? "Media tidak dapat dihapus.");
  };

  return (
    <div className="ed-section-content">
      <p className="ed-form-note">
        Format yang didukung: JPG, PNG, atau WebP. Ukuran maksimal 10 MB per
        gambar. File disimpan privat dan diverifikasi sebelum dapat digunakan.
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
          disabled={uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void handleFile(file);
            event.currentTarget.value = "";
          }}
        />
        <p className="ed-upload-box__hint">
          {uploading
            ? "File sedang dikirim dan diverifikasi. Jangan tutup halaman ini."
            : "Pilih satu foto dari perangkat Anda."}
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Mengunggah..." : "Pilih file"}
        </Button>
      </div>
      {actionError ? (
        <Alert variant="error" title="Media belum dapat diperbarui">
          {actionError}
        </Alert>
      ) : null}
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
              disabled={uploading}
              onClick={() => void handleDelete(asset)}
            >
              Hapus media
            </Button>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
