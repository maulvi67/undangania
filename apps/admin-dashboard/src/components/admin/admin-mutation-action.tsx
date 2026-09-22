"use client";

import { useState, type FormEvent } from "react";

type AdminMutationActionName =
  | "retry_failed_job"
  | "reconcile_payment"
  | "recover_publication"
  | "moderate_template"
  | "escalate_support"
  | "export_audit";

type AdminMutationTargetType = "notification" | "outbox";

type AdminMutationActionProps = Readonly<{
  action: AdminMutationActionName;
  targetId: string;
  label: string;
  targetType?: AdminMutationTargetType;
  templateVersion?: string;
  fromStatus?: string;
  toStatus?: string;
  exportResult?: boolean;
}>;

function idempotencyKey(): string {
  const generated = globalThis.crypto?.randomUUID?.();
  return (
    generated ?? `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function responseMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fallback;
  }
  const error = Reflect.get(value, "error");
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    return fallback;
  }
  const message = Reflect.get(error, "message");
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

export function AdminMutationAction({
  action,
  targetId,
  label,
  targetType,
  templateVersion,
  fromStatus,
  toStatus,
  exportResult = false,
}: AdminMutationActionProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [stepUpCode, setStepUpCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<
    | Readonly<{ kind: "idle" }>
    | Readonly<{ kind: "submitting" }>
    | Readonly<{ kind: "success"; message: string }>
    | Readonly<{ kind: "error"; message: string }>
  >({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || reason.trim() === "" || stepUpCode.trim() === "") {
      setState({
        kind: "error",
        message: "Reason, konfirmasi, dan kode MFA wajib diisi.",
      });
      return;
    }

    setState({ kind: "submitting" });
    const body: Record<string, string> = {
      action,
      targetId,
      reason: reason.trim(),
      confirmation: "CONFIRM",
      idempotencyKey: idempotencyKey(),
      stepUpCode: stepUpCode.trim(),
    };
    if (targetType !== undefined) body.targetType = targetType;
    if (templateVersion !== undefined) body.templateVersion = templateVersion;
    if (fromStatus !== undefined) body.fromStatus = fromStatus;
    if (toStatus !== undefined) body.toStatus = toStatus;

    try {
      const response = await fetch("/api/admin/mutations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody: unknown = await response.json();
      if (!response.ok) {
        setState({
          kind: "error",
          message: responseMessage(
            responseBody,
            "Operasi tidak dapat dijalankan.",
          ),
        });
        return;
      }
      setState({
        kind: "success",
        message: exportResult
          ? "Export audit masked siap diproses oleh server."
          : "Operasi berhasil dicatat dan diproses.",
      });
      setReason("");
      setStepUpCode("");
      setConfirmed(false);
    } catch {
      setState({
        kind: "error",
        message: "Koneksi ke layanan admin gagal. Coba lagi.",
      });
    }
  }

  return (
    <details
      className="admin-mutation"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{label}</summary>
      {state.kind === "success" ? (
        <p className="admin-mutation__feedback" role="status">
          {state.message}
        </p>
      ) : (
        <form className="admin-mutation__form" onSubmit={submit}>
          <label>
            Reason
            <textarea
              value={reason}
              maxLength={500}
              rows={2}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </label>
          <label>
            Kode MFA / step-up
            <input
              value={stepUpCode}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(event) => setStepUpCode(event.target.value)}
              required
            />
          </label>
          <label className="admin-mutation__confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Saya mengonfirmasi operasi ini.
          </label>
          {state.kind === "error" ? (
            <p className="admin-mutation__feedback" role="alert">
              {state.message}
            </p>
          ) : null}
          <button
            className="ui-button ui-button--secondary ui-button--sm"
            type="submit"
            disabled={state.kind === "submitting"}
          >
            {state.kind === "submitting" ? "Memproses…" : label}
          </button>
        </form>
      )}
    </details>
  );
}
