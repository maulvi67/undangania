"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  downloadMaskedAuditCsv,
  parseMaskedAuditExport,
} from "../../lib/admin/audit-export";

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
  const router = useRouter();
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
      if (exportResult) {
        const rows = parseMaskedAuditExport(responseBody);
        if (rows.length === 0) {
          setState({
            kind: "error",
            message:
              "Server tidak mengembalikan baris audit masked yang valid.",
          });
          return;
        }
        downloadMaskedAuditCsv(rows);
      }
      setState({
        kind: "success",
        message: exportResult
          ? "Export audit masked berhasil diunduh."
          : "Operasi berhasil dicatat dan diproses.",
      });
      router.refresh();
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
        <form className="admin-mutation__form grid min-w-60 gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-panel-muted)] p-3" onSubmit={submit}>
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
          <label className="admin-mutation__confirm flex items-start gap-2 text-xs font-medium">
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
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--color-accent)] bg-white px-3 text-xs font-bold text-[var(--color-accent-strong)] hover:bg-[var(--color-panel-muted)]"
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
