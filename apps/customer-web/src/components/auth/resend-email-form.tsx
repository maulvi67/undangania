"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Alert, Button } from "@wedding/ui";
import { resendVerificationAction } from "../../lib/auth/actions";
import { INITIAL_AUTH_FORM_STATE } from "../../lib/auth/contract";
import { EmailField } from "./email-field";
import { AuthLinkRow } from "./auth-link-row";
import { CheckEmailPanel } from "./check-email-panel";
import { formLevelMessage } from "./sign-in-form";

/**
 * Verification resend control (design plan §4.3).
 *
 * - With `email`: compact "Kirim ulang" button used by the post-register
 *   interstitial (the address is already known client-side).
 * - Without `email`: the email-entry mini-form on `/verifikasi` (expired-link
 *   recovery and direct visits). Success swaps to the check-email panel.
 */
export function ResendEmailForm({ email }: { email?: string | undefined }) {
  const [state, formAction, pending] = useActionState(
    resendVerificationAction,
    INITIAL_AUTH_FORM_STATE,
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state === INITIAL_AUTH_FORM_STATE) return;
    if (state.status === "done") {
      if (!email) {
        // Entry mode swaps the whole form for the panel — move focus once.
        panelHeadingRef.current?.focus();
      }
      return;
    }
    alertRef.current?.focus();
  }, [state, email]);

  // Entry mode after success: same interstitial as post-register.
  if (state.status === "done" && !email) {
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
            <Link href="/daftar">Gunakan email lain</Link>
          </span>
          <span>
            Sudah punya akun?{" "}
            <Link href="/masuk">Masuk</Link>
          </span>
        </AuthLinkRow>
      </CheckEmailPanel>
    );
  }

  const formError = formLevelMessage(state);

  return (
    <>
      {email ? null : (
        <>
          <h1 className="auth-title">Verifikasi email</h1>
          <p className="auth-lede">
            Masukkan email Anda untuk mengirim ulang tautan verifikasi.
          </p>
        </>
      )}
      {formError ? (
        <div className="auth-alert" tabIndex={-1} ref={alertRef}>
          <Alert variant="error" title={formError} />
        </div>
      ) : null}
      <form action={formAction} className="auth-form" noValidate>
        {email ? (
          <input type="hidden" name="email" value={email} />
        ) : (
          <EmailField autoComplete="email" error={state.fieldErrors.email} />
        )}
        <Button type="submit" size="lg" loading={pending} enterKeyHint="send">
          {email ? "Kirim ulang tautan verifikasi" : "Kirim tautan verifikasi"}
        </Button>
        {state.status === "done" && email ? (
          <p className="auth-resend-status" role="status">
            Tautan verifikasi telah dikirim ulang ke email Anda.
          </p>
        ) : null}
      </form>
      {email ? null : (
        <AuthLinkRow>
          <span>
            Sudah punya akun?{" "}
            <Link href="/masuk">Masuk</Link>
          </span>
        </AuthLinkRow>
      )}
    </>
  );
}
