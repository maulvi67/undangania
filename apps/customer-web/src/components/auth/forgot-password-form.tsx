"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Alert, Button } from "@wedding/ui";
import { requestPasswordResetAction } from "../../lib/auth/actions";
import { INITIAL_AUTH_FORM_STATE } from "../../lib/auth/contract";
import { EmailField } from "./email-field";
import { AuthLinkRow } from "./auth-link-row";
import { CheckEmailPanel } from "./check-email-panel";
import { formLevelMessage } from "./sign-in-form";

/**
 * `/lupa-sandi` form (design plan §4.4). The success state renders
 * always-identical copy for known and unknown emails (anti-enumeration R3) —
 * asserted byte-identical in e2e for both cases.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
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
    alertRef.current?.focus();
  }, [state]);

  if (state.status === "done") {
    return (
      <CheckEmailPanel flow="reset" headingRef={panelHeadingRef}>
        <AuthLinkRow>
          <Link href="/lupa-sandi">Kirim ulang tautan pemulihan</Link>
          <Link href="/masuk">Kembali ke masuk</Link>
        </AuthLinkRow>
      </CheckEmailPanel>
    );
  }

  const formError = formLevelMessage(state);

  return (
    <>
      <h1 className="auth-title">Lupa kata sandi?</h1>
      <p className="auth-lede">
        Masukkan email akun Anda dan kami akan mengirimkan tautan pemulihan.
      </p>
      {formError ? (
        <div className="auth-alert" tabIndex={-1} ref={alertRef}>
          <Alert variant="error" title={formError} />
        </div>
      ) : null}
      <form action={formAction} className="auth-form" noValidate>
        <EmailField autoComplete="email" error={state.fieldErrors.email} />
        <Button type="submit" size="lg" loading={pending} enterKeyHint="send">
          Kirim tautan pemulihan
        </Button>
      </form>
      <AuthLinkRow>
        <Link href="/masuk">Kembali ke masuk</Link>
      </AuthLinkRow>
    </>
  );
}
