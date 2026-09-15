"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button } from "@wedding/ui";
import {
  FORM_LEVEL_ERROR,
  IDLE_FLOW_STATE,
  ONBOARDING_FIELDS,
  createInitialData,
  hasAnyInput,
  type FieldErrors,
  type FlowState,
  type OnboardingData,
  type StepId,
} from "../../lib/onboarding/contract";
import {
  completeAction,
  loadDraftAction,
  saveStepAction,
} from "../../lib/onboarding/actions";
import {
  AUTOSAVE_DEBOUNCE_MS,
  clearStoredDraft,
  createDraftId,
  loadStoredDraft,
  saveStoredDraft,
} from "../../lib/onboarding/draft-store";
import { OnboardingProgress } from "./onboarding-progress";
import { ResumeBanner } from "./resume-banner";
import { SaveStatus, type SaveNotice } from "./save-status";
import { StepCouple } from "./step-couple";
import { StepEvent } from "./step-event";
import { StepPreferences } from "./step-preferences";
import { SummaryCard } from "./summary-card";

/**
 * Orkestrator alur onboarding 3 langkah (rencana §3–§8).
 *
 * Berbeda dari auth, status dikelola manual (bukan useActionState) karena
 * resolusi konflik versi dan "muat ulang draf" harus bisa menimpa state.
 * Draf localStorage adalah sumber resume; server (stub) adalah validator +
 * pemilik versi. Fokus pindah ke judul langkah hanya saat navigasi yang
 * dimulai pengguna — pulihkan draf tidak pernah mencuri fokus (rencana §7).
 */
export function OnboardingFlow({ templateId }: { templateId: string }) {
  const [step, setStep] = useState<StepId>(1);
  const [data, setData] = useState<OnboardingData>(createInitialData);
  const [version, setVersion] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>(IDLE_FLOW_STATE);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNotice>("idle");
  const [resumeInfo, setResumeInfo] = useState<{ savedAt: number } | null>(
    null,
  );
  const [finished, setFinished] = useState(false);
  const [completedData, setCompletedData] = useState<OnboardingData | null>(
    null,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const finishHeadingRef = useRef<HTMLHeadingElement>(null);
  const conflictHeadingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const headingFocusArmed = useRef(false);
  const finishFocusArmed = useRef(false);

  /* ---------- Pemuatan draf (sekali, khusus klien) ---------- */

  useEffect(() => {
    const stored = loadStoredDraft();
    if (stored) {
      // Pulihkan draf sekali setelah hidrasi: localStorage hanya ada di
      // klien, dan initializer useState akan mismatch HTML SSR. React 18+
      // menggabungkan seluruh setState ini menjadi satu render.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pembacaan satu kali dari sistem eksternal pasca-hidrasi
      setDraftId(stored.draftId);
      setData(stored.data);
      setVersion(stored.version);
      if (stored.completed === true) {
        setCompletedData(stored.data);
        setFinished(true);
      } else {
        setStep(stored.step);
        setResumeInfo({ savedAt: stored.updatedAt });
      }
    } else {
      setDraftId(createDraftId());
    }
  }, []);

  /* ---------- Autosave lokal (debounce 800ms) ---------- */

  useEffect(() => {
    if (draftId === null || finished) return;
    if (!hasAnyInput(data)) return; // kunjungan tanpa isian tidak membuat draf
    const timer = window.setTimeout(() => {
      saveStoredDraft({ draftId, step, version, updatedAt: Date.now(), data });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draftId, finished, data, step, version]);

  /* ---------- Fokus ---------- */

  // Judul langkah — hanya navigasi yang dimulai pengguna (advance/kembali/
  // muat ulang/mulai baru), tidak pernah saat pemulihan draf awal.
  useEffect(() => {
    if (!headingFocusArmed.current) return;
    headingFocusArmed.current = false;
    stepHeadingRef.current?.focus();
  }, [step, flowState, resumeInfo, finished]);

  useEffect(() => {
    if (!finished || !finishFocusArmed.current) return;
    finishFocusArmed.current = false;
    finishHeadingRef.current?.focus();
  }, [finished]);

  // Galat: fokus ke isian tidak valid pertama (fallback: Alert). Konflik:
  // fokus ke judul panel pengganti.
  useEffect(() => {
    if (flowState.kind === "error") {
      const firstInvalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      );
      if (firstInvalid) firstInvalid.focus();
      else alertRef.current?.focus();
      return;
    }
    if (flowState.kind === "conflict") {
      conflictHeadingRef.current?.focus();
    }
  }, [flowState]);

  /* ---------- Pembaruan isian ---------- */

  const update = (patch: Partial<OnboardingData>) => {
    setSaveNotice("idle");
    setData((prev) => {
      const merged = { ...prev, ...patch };
      // Mencentang "belum ditentukan" mengosongkan tanggal (rencana §4).
      if (patch.weddingDateUndecided === true) merged.weddingDate = "";
      return merged;
    });
    // Galat isian yang sedang diperbaiki dihapus; galat lain dibiarkan.
    setFlowState((prev) => {
      if (prev.kind !== "error") return prev;
      const remaining = { ...prev.fieldErrors };
      for (const field of ONBOARDING_FIELDS) {
        if (field in patch) delete remaining[field];
      }
      if ("weddingDateUndecided" in patch) delete remaining.weddingDate;
      return Object.keys(remaining).length === 0
        ? IDLE_FLOW_STATE
        : { kind: "error", fieldErrors: remaining };
    });
  };

  /* ---------- Simpan / selesai / konflik ---------- */

  function appendStepFields(
    formData: FormData,
    targetStep: StepId,
    source: OnboardingData,
  ) {
    if (targetStep === 1) {
      formData.set("partner1Name", source.partner1Name);
      formData.set("partner2Name", source.partner2Name);
      formData.set("weddingDate", source.weddingDate);
      if (source.weddingDateUndecided)
        formData.set("weddingDateUndecided", "on");
      return;
    }
    if (targetStep === 2) {
      formData.set("eventType", source.eventType);
      formData.set("eventDate", source.eventDate);
      formData.set("eventTime", source.eventTime);
      formData.set("city", source.city);
      formData.set("timezone", source.timezone);
      formData.set("venueName", source.venueName);
      formData.set("venueAddress", source.venueAddress);
      return;
    }
    formData.set("locale", source.locale);
  }

  /** FormData dari state React — untuk "Timpa dengan isian ini" saat konflik. */
  function buildFormData(force: boolean): FormData {
    const formData = new FormData();
    formData.set("step", String(step));
    formData.set("draftId", draftId ?? "");
    formData.set("baseVersion", String(version));
    if (force) formData.set("force", "1");
    appendStepFields(formData, step, data);
    return formData;
  }

  const submit = async (formData: FormData) => {
    if (saving) return;
    setSaving(true);
    setSaveNotice("saving");
    try {
      const result =
        step === 3
          ? await completeAction(formData)
          : await saveStepAction(formData);

      if (result.kind === "saved") {
        setVersion(result.version);
        setSaveNotice("saved");
        setFlowState(IDLE_FLOW_STATE);
        headingFocusArmed.current = true;
        setStep(step === 1 ? 2 : 3);
        return;
      }
      if (result.kind === "completed") {
        setVersion(result.version);
        setSaveNotice("saved");
        setCompletedData(result.data);
        if (draftId !== null) {
          saveStoredDraft({
            draftId,
            step: 3,
            version: result.version,
            updatedAt: Date.now(),
            completed: true,
            data: result.data,
          });
        }
        setFlowState(IDLE_FLOW_STATE);
        finishFocusArmed.current = true;
        setFinished(true);
        return;
      }
      setSaveNotice("idle");
      setFlowState(result);
    } catch {
      // Aksi server gagal dijangkau (jaringan) — status coba-lagi yang sama.
      setSaveNotice("idle");
      setFlowState({ kind: "retryable", code: "SAVE_FAILED" });
    } finally {
      setSaving(false);
    }
  };

  const reloadServerDraft = async () => {
    const id = draftId;
    if (id === null || reloading) return;
    setReloading(true);
    try {
      const server = await loadDraftAction(id);
      if (server) {
        setData(server.data);
        setVersion(server.version);
        setStep(server.step);
      }
      setSaveNotice("idle");
      setFlowState(IDLE_FLOW_STATE);
      headingFocusArmed.current = true;
    } catch {
      setFlowState({ kind: "retryable", code: "UNAVAILABLE" });
    } finally {
      setReloading(false);
    }
  };

  /* ---------- Navigasi dan reset ---------- */

  const goToStep = (target: StepId) => {
    headingFocusArmed.current = true;
    setFlowState(IDLE_FLOW_STATE);
    setSaveNotice("idle");
    setStep(target);
  };

  const restart = () => {
    clearStoredDraft();
    setDraftId(createDraftId());
    setData(createInitialData());
    setStep(1);
    setVersion(0);
    setFlowState(IDLE_FLOW_STATE);
    setSaveNotice("idle");
    setResumeInfo(null);
    setFinished(false);
    setCompletedData(null);
    setSaving(false);
    headingFocusArmed.current = true;
    stepHeadingRef.current?.focus();
  };

  /* ---------- Render ---------- */

  const editorHref =
    templateId !== ""
      ? `/editor?template=${encodeURIComponent(templateId)}`
      : "/editor";

  if (finished) {
    const summary = completedData ?? data;
    return (
      <section className="onb-panel">
        <h1 className="onb-panel__title" tabIndex={-1} ref={finishHeadingRef}>
          Persiapan selesai
        </h1>
        <p className="onb-panel__body">
          Data dasar undangan Anda sudah tersimpan. Lanjutkan di editor untuk
          menyusun undangan.
        </p>
        <SummaryCard data={summary} title="Ringkasan isian" />
        <div className="onb-panel__actions">
          <Link
            className="ui-button ui-button--primary ui-button--lg"
            href={editorHref}
          >
            Mulai edit undangan
          </Link>
          <Link
            className="ui-button ui-button--secondary ui-button--lg"
            href="/templates"
          >
            Lihat koleksi desain
          </Link>
          <Button variant="tertiary" size="lg" onClick={restart}>
            Isi ulang
          </Button>
        </div>
      </section>
    );
  }

  if (flowState.kind === "conflict") {
    return (
      <>
        <OnboardingProgress step={step} />
        <section className="onb-panel">
          <h1
            className="onb-panel__title"
            tabIndex={-1}
            ref={conflictHeadingRef}
          >
            Draf tersimpan lebih baru
          </h1>
          <p className="onb-panel__body">
            Isian di layar ini lebih lama daripada draf yang tersimpan di
            server. Pilih versi yang ingin dipertahankan.
          </p>
          <SummaryCard
            data={flowState.serverData}
            title="Draf tersimpan di server"
          />
          <div className="onb-panel__actions">
            <Button
              onClick={() => void reloadServerDraft()}
              loading={reloading}
            >
              Muat ulang draf
            </Button>
            <Button
              variant="secondary"
              onClick={() => void submit(buildFormData(true))}
              loading={saving}
            >
              Timpa dengan isian ini
            </Button>
          </div>
        </section>
      </>
    );
  }

  const fieldErrors: FieldErrors =
    flowState.kind === "error" ? flowState.fieldErrors : {};

  return (
    <>
      <OnboardingProgress step={step} />
      {resumeInfo ? (
        <ResumeBanner
          savedAt={resumeInfo.savedAt}
          onContinue={() => setResumeInfo(null)}
          onRestart={restart}
        />
      ) : null}
      {flowState.kind === "error" ? (
        <div className="onb-alert" tabIndex={-1} ref={alertRef}>
          <Alert variant="error" title={FORM_LEVEL_ERROR} />
        </div>
      ) : null}
      {flowState.kind === "retryable" ? (
        <div className="onb-alert">
          <Alert
            variant="error"
            title="Gagal menyimpan. Perubahan Anda tetap tersimpan di perangkat ini."
          />
          <div className="onb-alert__actions">
            <Button
              onClick={() => formRef.current?.requestSubmit()}
              loading={saving}
            >
              Coba simpan lagi
            </Button>
          </div>
        </div>
      ) : null}
      <form
        ref={formRef}
        action={(formData) => void submit(formData)}
        noValidate
        className="onb-form"
      >
        <input type="hidden" name="step" value={String(step)} />
        <input type="hidden" name="draftId" value={draftId ?? ""} />
        <input type="hidden" name="baseVersion" value={String(version)} />
        {step === 1 ? (
          <StepCouple
            data={data}
            errors={fieldErrors}
            headingRef={stepHeadingRef}
            onFieldChange={update}
          />
        ) : null}
        {step === 2 ? (
          <StepEvent
            data={data}
            errors={fieldErrors}
            headingRef={stepHeadingRef}
            onFieldChange={update}
          />
        ) : null}
        {step === 3 ? (
          <StepPreferences
            data={data}
            errors={fieldErrors}
            headingRef={stepHeadingRef}
            onFieldChange={update}
            onEditStep={goToStep}
          />
        ) : null}
        <div className="onb-actions">
          {step > 1 ? (
            <Button
              type="button"
              variant="tertiary"
              size="lg"
              onClick={() => goToStep(step === 3 ? 2 : 1)}
            >
              Kembali
            </Button>
          ) : null}
          <Button type="submit" size="lg" loading={saving}>
            {step < 3 ? "Simpan & lanjut" : "Selesai"}
          </Button>
        </div>
        <SaveStatus notice={saveNotice} />
      </form>
    </>
  );
}
