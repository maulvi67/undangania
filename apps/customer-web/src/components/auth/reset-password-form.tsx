"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Alert, Button } from "@wedding/ui";
import { resetPasswordAction } from "../../lib/auth/actions";
import {
  INITIAL_AUTH_FORM_STATE,
  MIN_PASSWORD_LENGTH,
  formLevelMessage,
} from "../../lib/auth/contract";
import { PasswordField } from "./password-field";
import { TokenStatePanel } from "./token-state-panel";

/**
 * `/reset-sandi` form (design plan §4.5). The page has already validated the
 * token server-side before rendering this form; the action re-validates on
 * submit (the token may expire while the page is open). No auto-login (R6):
 * success hands off to `/masuk`.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    INITIAL_AUTH_FORM_STATE,
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state === INITIAL_AUTH_FORM_STATE) return;
    if (state.status === "done") {
      panelHeadingRef.current?.focus();
      return;
    }
    if (state.code === "TOKEN_EXPIRED" || state.code === "TOKEN_INVALID") {
      panelHeadingRef.current?.focus();
      return;
    }
    alertRef.current?.focus();
  }, [state]);

  if (state.status === "done") {
    return (
      <section className="auth-panel">
        <h1 className="auth-panel__title" tabIndex={-1} ref={panelHeadingRef}>
          Kata sandi diperbarui
        </h1>
        <p className="auth-panel__body">
          Kata sandi Anda berhasil diperbarui. Silakan masuk dengan kata sandi
          baru Anda.
        </p>
        <div className="auth-panel__actions">
          <Link
            className="ui-button ui-button--primary ui-button--lg"
            href="/masuk"
          >
            Masuk dengan kata sandi baru
          </Link>
        </div>
      </section>
    );
  }

  if (state.code === "TOKEN_EXPIRED" || state.code === "TOKEN_INVALID") {
    return (
      <TokenStatePanel
        headingRef={panelHeadingRef}
        kind={state.code === "TOKEN_EXPIRED" ? "expired" : "invalid"}
        flow="reset"
      />
    );
  }

  const formError = formLevelMessage(state);

  return (
    <>
      <h1 className="auth-title">Atur ulang kata sandi</h1>
      <p className="auth-lede">Buat kata sandi baru untuk akun Anda.</p>
      {formError ? (
        <div className="auth-alert" tabIndex={-1} ref={alertRef}>
          <Alert variant="error" title={formError} />
        </div>
      ) : null}
      <form action={formAction} className="auth-form" noValidate>
        <input type="hidden" name="token" value={token} />
        <PasswordField
          id="kata-sandi-baru"
          label="Kata sandi baru"
          autoComplete="new-password"
          hint={`Minimal ${MIN_PASSWORD_LENGTH} karakter. Anda bisa menempel kata sandi dari pengelola kata sandi.`}
          error={state.fieldErrors.password}
          enterKeyHint="done"
        />
        <Button type="submit" size="lg" loading={pending} enterKeyHint="done">
          Simpan kata sandi baru
        </Button>
      </form>
    </>
  );
}
