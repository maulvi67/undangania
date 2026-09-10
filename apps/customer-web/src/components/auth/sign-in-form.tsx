"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Alert, Button } from "@wedding/ui";
import { signInAction } from "../../lib/auth/actions";
import {
  AUTH_ERROR_MESSAGES,
  INITIAL_AUTH_FORM_STATE,
  type AuthFormState,
} from "../../lib/auth/contract";
import { EmailField } from "./email-field";
import { PasswordField } from "./password-field";
import { AuthLinkRow } from "./auth-link-row";

/**
 * `/masuk` form (design plan §4.1). `next` is the SERVER-validated redirect
 * target (the page ran it through safeRedirectTarget); the action re-validates
 * again before redirecting — the client copy is never trusted.
 */
export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL_AUTH_FORM_STATE);
  const alertRef = useRef<HTMLDivElement>(null);
  const suspendedHeadingRef = useRef<HTMLHeadingElement>(null);

  const withNext = (path: string) =>
    next && next !== "/" ? `${path}?next=${encodeURIComponent(next)}` : path;

  useEffect(() => {
    if (state === INITIAL_AUTH_FORM_STATE) return;
    if (state.code === "SUSPENDED") {
      suspendedHeadingRef.current?.focus();
      return;
    }
    if (state.status === "error") {
      alertRef.current?.focus();
    }
  }, [state]);

  // Screen 9: suspended accounts are valid-credential holders — a dedicated
  // panel explains the state without offering a way to retry the same account.
  if (state.code === "SUSPENDED") {
    return (
      <section className="auth-panel">
        <h1 className="auth-panel__title" tabIndex={-1} ref={suspendedHeadingRef}>
          Akun ditangguhkan
        </h1>
        <p className="auth-panel__body">
          Akun Anda sedang ditangguhkan sehingga tidak dapat digunakan untuk
          masuk. Silakan hubungi dukungan untuk membuka kembali akun Anda.
        </p>
        <div className="auth-panel__actions">
          <Link className="ui-button ui-button--primary ui-button--md" href="/">
            Kembali ke beranda
          </Link>
        </div>
        <AuthLinkRow>
          <Link href="/masuk">Masuk dengan akun lain</Link>
        </AuthLinkRow>
      </section>
    );
  }

  const formError = formLevelMessage(state);

  return (
    <>
      <h1 className="auth-title">Masuk</h1>
      <p className="auth-lede">Lanjutkan persiapan undangan Anda.</p>
      {formError ? (
        <div className="auth-alert" tabIndex={-1} ref={alertRef}>
          <Alert variant="error" title={formError} />
        </div>
      ) : null}
      <form action={formAction} className="auth-form" noValidate>
        <input type="hidden" name="next" value={next} />
        <EmailField autoComplete="username" error={state.fieldErrors.email} />
        <PasswordField
          autoComplete="current-password"
          error={state.fieldErrors.password}
          enterKeyHint="go"
        />
        <Button type="submit" size="lg" loading={pending} enterKeyHint="go">
          Masuk
        </Button>
      </form>
      <AuthLinkRow>
        <Link href={withNext("/lupa-sandi")}>Lupa kata sandi?</Link>
        <span>
          Belum punya akun?{" "}
          <Link href={withNext("/daftar")}>Daftar</Link>
        </span>
      </AuthLinkRow>
    </>
  );
}

/** Form-level copy for the current state; field errors carry the specifics. */
export function formLevelMessage(state: AuthFormState): string {
  if (state.status !== "error" || !state.code) return "";
  return AUTH_ERROR_MESSAGES[state.code];
}
