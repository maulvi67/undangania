"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Alert, Button } from "@wedding/ui";
import { registerAction } from "../../lib/auth/actions";
import {
  INITIAL_AUTH_FORM_STATE,
  MIN_PASSWORD_LENGTH,
} from "../../lib/auth/contract";
import { EmailField } from "./email-field";
import { PasswordField } from "./password-field";
import { AuthLinkRow } from "./auth-link-row";
import { CheckEmailPanel } from "./check-email-panel";
import { ResendEmailForm } from "./resend-email-form";
import { formLevelMessage } from "./sign-in-form";

/**
 * `/daftar` form (design plan §4.2). Success — including a duplicate email
 * (R4) — always swaps to the same interstitial; there is no "email sudah
 * dipakai" state anywhere in the UI.
 */
export function RegisterForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(registerAction, INITIAL_AUTH_FORM_STATE);
  const alertRef = useRef<HTMLDivElement>(null);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);

  const withNext = (path: string) =>
    next && next !== "/" ? `${path}?next=${encodeURIComponent(next)}` : path;

  useEffect(() => {
    if (state === INITIAL_AUTH_FORM_STATE) return;
    if (state.status === "done") {
      panelHeadingRef.current?.focus();
      return;
    }
    alertRef.current?.focus();
  }, [state]);

  if (state.status === "done") {
    return (
      <CheckEmailPanel
        flow="verification"
        email={state.emailSentTo}
        headingRef={panelHeadingRef}
      >
        <ResendEmailForm email={state.emailSentTo} />
        <AuthLinkRow>
          <span>
            Salah email?{" "}
            <Link href={withNext("/daftar")}>Gunakan email lain</Link>
          </span>
          <span>
            Sudah punya akun?{" "}
            <Link href={withNext("/masuk")}>Masuk</Link>
          </span>
        </AuthLinkRow>
      </CheckEmailPanel>
    );
  }

  const formError = formLevelMessage(state);

  return (
    <>
      <h1 className="auth-title">Buat akun</h1>
      <p className="auth-lede">Satu akun untuk mengelola undangan Anda.</p>
      {formError ? (
        <div className="auth-alert" tabIndex={-1} ref={alertRef}>
          <Alert variant="error" title={formError} />
        </div>
      ) : null}
      <form action={formAction} className="auth-form" noValidate>
        <EmailField autoComplete="email" error={state.fieldErrors.email} />
        <PasswordField
          autoComplete="new-password"
          hint={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
          error={state.fieldErrors.password}
          enterKeyHint="send"
        />
        <Button type="submit" size="lg" loading={pending} enterKeyHint="send">
          Daftar
        </Button>
      </form>
      <AuthLinkRow>
        <span>
          Sudah punya akun?{" "}
          <Link href={withNext("/masuk")}>Masuk</Link>
        </span>
      </AuthLinkRow>
    </>
  );
}
