"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@wedding/ui";
import type {
  EditorDocument,
  EditorFixture,
  EditorLoadResult,
  EditorMediaState,
  EditorSectionId,
} from "../../lib/editor/contract";
import {
  publicationReadiness,
  toInvitationViewModel,
} from "../../lib/editor/contract";
import {
  loadStoredEditorDraft,
  saveStoredEditorDraft,
  clearStoredEditorDraft,
  type StoredEditorDraft,
} from "../../lib/editor/draft-store";
import {
  mergeStaleDocument,
  keepLocalContent,
  type StaleConflict,
} from "../../lib/editor/stale-merge";
import { reduceAutosaveState } from "../../lib/editor/autosave-state";
import {
  hasPendingMedia,
  mediaStateForContent,
  reconcileMediaAssets,
} from "../../lib/editor/media-reconciliation";
import { saveEditorDocument } from "../../lib/editor/transport";
import {
  publishInvitationAction,
  type PublishOutcome,
} from "../../lib/editor/publish-action";
import { EditorHeader } from "./editor-header";
import { SectionNavigation } from "./section-navigation";
import { EditorForm, type EditorPatch } from "./editor-form";
import { DevicePreview } from "./device-preview";
import { MobilePreviewDialog } from "./mobile-preview-dialog";
import { PublicationReadiness } from "./publication-readiness";
import { StaleVersionPanel } from "./stale-version-panel";
import { EditorProviderState } from "./provider-state";
import { listMediaAssetsAction } from "../../lib/media/actions";

export function EditorRouteView({
  result,
  fixture,
  initialSection,
}: {
  result: EditorLoadResult;
  fixture: EditorFixture;
  initialSection: EditorSectionId;
}) {
  if (result.kind !== "ok") {
    return (
      <main className="ed-page ed-page--state">
        <a className="ui-skip-link" href="#konten-utama">
          Langsung ke konten utama
        </a>
        <header className="ed-header">
          <div className="ed-header__inner">
            <Link className="ed-header__brand" href="/">
              Wedding System
            </Link>
          </div>
        </header>
        <div className="ed-state-main" id="konten-utama">
          <EditorProviderState
            kind={result.kind === "forbidden" ? "forbidden" : "unavailable"}
          />
        </div>
      </main>
    );
  }
  return (
    <EditorShell
      result={result}
      fixture={fixture}
      initialSection={initialSection}
    />
  );
}

function EditorShell({
  result,
  fixture,
  initialSection,
}: {
  result: Extract<EditorLoadResult, { kind: "ok" }>;
  fixture: EditorFixture;
  initialSection: EditorSectionId;
}) {
  const [document, setDocument] = useState<EditorDocument>(result.document);
  const [baseDocument, setBaseDocument] = useState<EditorDocument>(
    result.document,
  );
  const [activeSection, setActiveSection] =
    useState<EditorSectionId>(initialSection);
  const [saveState, setSaveState] = useState(result.initialSaveState);
  const [uploadState, setUploadState] = useState<EditorMediaState | null>(
    result.initialUploadState,
  );
  const [mediaRefreshError, setMediaRefreshError] = useState(false);
  const [previewMode, setPreviewMode] = useState<"phone" | "desktop">("phone");
  const [recoveryDraft, setRecoveryDraft] = useState<StoredEditorDraft | null>(
    null,
  );
  const [publishing, setPublishing] = useState(false);
  const [publishOutcome, setPublishOutcome] = useState<PublishOutcome | null>(
    null,
  );
  const [conflict, setConflict] = useState<{
    local: EditorDocument;
    server: EditorDocument;
    merged: EditorDocument;
    conflicts: ReadonlyArray<StaleConflict>;
  } | null>(null);
  const documentRef = useRef(document);
  const baseDocumentRef = useRef(baseDocument);
  const savingRef = useRef(false);
  const publishingRef = useRef(false);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    baseDocumentRef.current = baseDocument;
  }, [baseDocument]);

  useEffect(() => {
    const stored = loadStoredEditorDraft(result.document.invitationId);
    if (!stored || stored.document.updatedAt === result.document.updatedAt)
      return;
    const timer = window.setTimeout(() => setRecoveryDraft(stored), 0);
    return () => window.clearTimeout(timer);
  }, [result.document.invitationId, result.document.updatedAt]);

  useEffect(() => {
    const root = globalThis.document.querySelector<HTMLElement>(".ed-shell");
    if (!root) return;

    const keepFocusedControlVisible = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !root.contains(target)) return;
      if (target.closest(".ed-mobile-preview-trigger")) return;

      window.requestAnimationFrame(() => {
        if (globalThis.document.activeElement !== target) return;
        const action = root.querySelector<HTMLElement>(
          ".ed-mobile-preview-trigger",
        );
        const actionRect = action?.getBoundingClientRect();
        if (!actionRect || actionRect.width === 0 || actionRect.height === 0)
          return;

        const headerRect = root
          .querySelector<HTMLElement>(".ed-header")
          ?.getBoundingClientRect();
        const topBoundary = Math.max(headerRect?.bottom ?? 0, 0) + 12;
        const bottomBoundary =
          actionRect.top > topBoundary && actionRect.top < window.innerHeight
            ? actionRect.top - 12
            : window.innerHeight - 12;
        const targetRect = target.getBoundingClientRect();
        const scrollDelta =
          targetRect.top < topBoundary
            ? targetRect.top - topBoundary
            : targetRect.bottom > bottomBoundary
              ? targetRect.bottom - bottomBoundary
              : 0;
        if (scrollDelta !== 0) window.scrollBy(0, scrollDelta);
      });
    };

    root.addEventListener("focusin", keepFocusedControlVisible);
    return () => root.removeEventListener("focusin", keepFocusedControlVisible);
  }, []);

  const updateContent = useCallback((patch: EditorPatch) => {
    setDocument((current) => {
      const nextPatch =
        typeof patch === "function" ? patch(current.content) : patch;
      return {
        ...current,
        content: { ...current.content, ...nextPatch },
      };
    });
    setConflict(null);
    setSaveState((current) => reduceAutosaveState(current, { type: "CHANGE" }));
  }, []);

  const handleUploadState = useCallback((state: EditorMediaState | null) => {
    setUploadState(state);
    if (state === "PROCESSING" || state === "SCANNING")
      setSaveState((current) =>
        reduceAutosaveState(current, { type: "UPLOAD_PROCESSING" }),
      );
    if (state === "REJECTED")
      setSaveState((current) =>
        reduceAutosaveState(current, { type: "UPLOAD_REJECTED" }),
      );
  }, []);

  useEffect(() => {
    if (fixture !== "normal" || !hasPendingMedia(document.content)) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const refreshMedia = async () => {
      if (cancelled || attempts >= maxAttempts) return;
      attempts += 1;
      const outcome = await listMediaAssetsAction();
      if (cancelled) return;
      if (outcome.kind !== "ok") {
        setMediaRefreshError(true);
        return;
      }

      setMediaRefreshError(false);
      const current = documentRef.current;
      const reconciled = reconcileMediaAssets(current.content, outcome);
      if (!reconciled.changed) return;

      const nextDocument: EditorDocument = {
        ...current,
        content: reconciled.content,
      };
      documentRef.current = nextDocument;
      setDocument(nextDocument);
      const nextState = mediaStateForContent(nextDocument.content);
      setUploadState(nextState);
      if (nextState === "PROCESSING" || nextState === "SCANNING") {
        setSaveState((state) =>
          reduceAutosaveState(state, { type: "UPLOAD_PROCESSING" }),
        );
      } else if (nextState === "REJECTED") {
        setSaveState((state) =>
          reduceAutosaveState(state, { type: "UPLOAD_REJECTED" }),
        );
      } else {
        setSaveState((state) => reduceAutosaveState(state, { type: "CHANGE" }));
      }
    };

    void refreshMedia();
    const timer = window.setInterval(() => void refreshMedia(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [document.content, fixture]);

  const finishSave = useCallback((saved: EditorDocument) => {
    documentRef.current = saved;
    baseDocumentRef.current = saved;
    setDocument(saved);
    setBaseDocument(saved);
    setSaveState("saved");
    clearStoredEditorDraft(saved.invitationId);
  }, []);

  useEffect(() => {
    if (
      !["dirty", "upload-processing", "upload-rejected"].includes(saveState) ||
      savingRef.current
    )
      return;
    const timer = window.setTimeout(() => {
      const snapshot = documentRef.current;
      const base = baseDocumentRef.current;
      savingRef.current = true;
      setSaveState("saving");
      void saveEditorDocument({
        fixture,
        document: snapshot,
        baseVersion: base.version,
      })
        .then((action) => {
          savingRef.current = false;
          if (action.kind === "saved") {
            if (documentRef.current === snapshot) finishSave(action.document);
            else setSaveState("dirty");
            return;
          }
          if (action.kind === "stale") {
            const merge = mergeStaleDocument(
              snapshot,
              action.serverDocument,
              base,
            );
            if (merge.conflicts.length === 0) {
              setDocument(merge.merged);
              documentRef.current = merge.merged;
              setBaseDocument(action.serverDocument);
              baseDocumentRef.current = action.serverDocument;
              setSaveState("dirty");
            } else {
              setConflict({
                local: snapshot,
                server: action.serverDocument,
                merged: merge.merged,
                conflicts: merge.conflicts,
              });
              setSaveState("stale-version");
            }
            return;
          }
          if (action.kind === "invalid") {
            setSaveState("invalid-section");
            return;
          }
          if (action.kind === "offline") {
            saveStoredEditorDraft(snapshot.invitationId, {
              document: snapshot,
              baseVersion: base.version,
              savedAt: Date.now(),
            });
            setSaveState("offline");
            return;
          }
          if (action.kind === "save-failed") {
            saveStoredEditorDraft(snapshot.invitationId, {
              document: snapshot,
              baseVersion: base.version,
              savedAt: Date.now(),
            });
            setSaveState("save-failed");
            return;
          }
          if (action.kind === "provider-unavailable") {
            saveStoredEditorDraft(snapshot.invitationId, {
              document: snapshot,
              baseVersion: base.version,
              savedAt: Date.now(),
            });
            setSaveState("provider-unavailable");
            return;
          }
          if (action.kind === "entitlement-limit-reached") {
            setSaveState("entitlement-limit-reached");
            return;
          }
          setSaveState("unauthorized");
        })
        .catch(() => {
          savingRef.current = false;
          saveStoredEditorDraft(snapshot.invitationId, {
            document: snapshot,
            baseVersion: base.version,
            savedAt: Date.now(),
          });
          setSaveState("save-failed");
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [document, fixture, finishSave, saveState]);

  const retrySave = useCallback(
    () =>
      setSaveState((current) =>
        reduceAutosaveState(current, { type: "RETRY" }),
      ),
    [],
  );
  const restoreRecovery = useCallback(() => {
    if (!recoveryDraft) return;
    setDocument({
      ...recoveryDraft.document,
      version: baseDocumentRef.current.version,
    });
    setRecoveryDraft(null);
    setSaveState("dirty");
  }, [recoveryDraft]);

  const resolveConflict = useCallback(
    (key: StaleConflict["key"], useLocal: boolean) => {
      setConflict((current) => {
        if (!current) return current;
        const merged = useLocal
          ? keepLocalContent(current.merged, current.local, key)
          : current.merged;
        const remaining = current.conflicts.filter((item) => item.key !== key);
        if (remaining.length > 0)
          return { ...current, merged, conflicts: remaining };
        setDocument(merged);
        documentRef.current = merged;
        setBaseDocument(current.server);
        baseDocumentRef.current = current.server;
        setSaveState("dirty");
        return null;
      });
    },
    [],
  );

  const discardLocalChanges = useCallback(() => {
    if (!conflict) return;
    setDocument(conflict.server);
    documentRef.current = conflict.server;
    setBaseDocument(conflict.server);
    baseDocumentRef.current = conflict.server;
    setConflict(null);
    setSaveState("saved");
  }, [conflict]);

  /**
   * Publishes the stored draft.
   *
   * The version sent is the one this editor last saw from the server, not the
   * possibly-newer local document: publication must be refused if someone else
   * has saved since, which is exactly what the server's version guard compares.
   */
  const publish = useCallback(async () => {
    if (publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    try {
      setPublishOutcome(
        await publishInvitationAction({
          baseVersion: baseDocumentRef.current.version,
          templateId: result.template.id,
        }),
      );
    } catch {
      setPublishOutcome({ kind: "unavailable" });
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }, [result.template.id]);

  const model = toInvitationViewModel(document.content);
  const readiness = publicationReadiness(
    document.content,
    result.template.manifest,
  );
  const statusMessage =
    uploadState === "UPLOADED"
      ? "Media sudah diunggah dan sedang menunggu pemeriksaan. Media belum tampil di undangan publik."
      : uploadState === "SCANNING"
        ? "Media sedang diperiksa untuk keamanan. Media belum tampil di undangan publik."
        : uploadState === "PROCESSING"
          ? "Media sedang diproses; bagian ini belum siap untuk publikasi."
          : null;

  return (
    <div className="ed-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke formulir editor
      </a>
      <EditorHeader
        invitationTitle={document.content.settings.invitationTitle}
        saveState={saveState}
        onRetry={retrySave}
      />
      <main className="ed-main" id="konten-utama">
        <div className="ui-container">
          {recoveryDraft ? (
            <Alert variant="info" title="Ada draf pemulihan di perangkat ini">
              Ditemukan perubahan lokal dari{" "}
              {new Date(recoveryDraft.savedAt).toLocaleString("id-ID")}. Draf
              lokal bukan sumber penyimpanan utama dan hanya akan digunakan bila
              Anda memilih memulihkannya.
              <button
                type="button"
                className="ed-inline-action"
                onClick={restoreRecovery}
              >
                Pulihkan perubahan lokal
              </button>
            </Alert>
          ) : null}
          {statusMessage ? (
            <Alert variant="info" title="Status media diperbarui otomatis">
              {statusMessage}
            </Alert>
          ) : null}
          {mediaRefreshError ? (
            <Alert variant="warning" title="Status media belum diperbarui">
              Kami belum dapat mengambil status terbaru. Halaman akan mencoba
              lagi selama sekitar satu menit; jangan unggah ulang selama media
              masih terlihat di daftar.
            </Alert>
          ) : null}
          {saveState === "offline" ? (
            <Alert variant="warning" title="Anda sedang offline">
              Perubahan terbaru disimpan sebagai pemulihan lokal. Hubungkan
              kembali untuk mengirimkannya ke workspace.
            </Alert>
          ) : null}
          {saveState === "save-failed" ? (
            <Alert variant="error" title="Perubahan belum tersimpan">
              Periksa koneksi Anda lalu pilih “Coba simpan lagi”. Draf lokal
              disimpan bila browser mengizinkannya.
            </Alert>
          ) : null}
          {saveState === "entitlement-limit-reached" ? (
            <Alert variant="warning" title="Batas paket tercapai">
              Perubahan ini belum dikirim karena batas paket atau hak akses
              workspace perlu diperiksa.
            </Alert>
          ) : null}
          {saveState === "provider-unavailable" ? (
            <Alert variant="error" title="Layanan penyimpanan tidak tersedia">
              Draf masih terbuka di halaman ini, tetapi perubahan belum dapat
              dikirim ke workspace.
            </Alert>
          ) : null}
          {conflict ? (
            <StaleVersionPanel
              conflicts={conflict.conflicts}
              onKeepLocal={(key) => resolveConflict(key, true)}
              onUseServer={(key) => resolveConflict(key, false)}
              onDiscardLocal={discardLocalChanges}
            />
          ) : null}
          <PublicationReadiness
            readiness={readiness}
            onSelect={setActiveSection}
            onPublish={() => void publish()}
            pending={publishing}
            outcome={publishOutcome}
          />
          <div className="ed-mobile-section-picker">
            <label htmlFor="ed-mobile-section">Bagian yang sedang diedit</label>
            <select
              id="ed-mobile-section"
              value={activeSection}
              onChange={(event) =>
                setActiveSection(event.currentTarget.value as EditorSectionId)
              }
            >
              {Object.entries({
                couple: "Mempelai",
                events: "Acara",
                venue: "Lokasi & peta",
                cover: "Sampul",
                story: "Kisah",
                gallery: "Galeri",
                music: "Musik",
                gift: "Hadiah",
                faq: "FAQ",
                visibility: "Tampilan bagian",
                order: "Urutan bagian",
                settings: "Pengaturan undangan",
              }).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="ed-workspace">
            <aside className="ed-sidebar">
              <SectionNavigation
                content={document.content}
                template={result.template}
                activeSection={activeSection}
                onSelect={setActiveSection}
              />
            </aside>
            <div className="ed-editor-column">
              <EditorForm
                content={document.content}
                template={result.template}
                activeSection={activeSection}
                onChange={updateContent}
                onUploadState={handleUploadState}
              />
              <MobilePreviewDialog model={model} template={result.template} />
            </div>
            <aside className="ed-preview-column">
              <DevicePreview
                model={model}
                template={result.template}
                mode={previewMode}
                onModeChange={setPreviewMode}
              />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
