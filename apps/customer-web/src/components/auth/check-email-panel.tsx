import type { ReactNode, RefObject } from "react";

type CheckEmailPanelProps = {
  flow: "verification" | "reset";
  /**
   * Verification echoes the address the user just typed (their own input).
   * The reset flow renders always-identical copy and never echoes it.
   */
  email?: string | undefined;
  /** Attached to the h1 so the owning form can move focus after the swap. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** Actions: resend control and cross-links, owned by the mounting form. */
  children?: ReactNode;
};

/**
 * Shared "check your email" interstitial (design plan §4.2–§4.4).
 *
 * The reset variant's copy is byte-identical for known and unknown emails
 * (anti-enumeration R3) — asserted in e2e.
 */
export function CheckEmailPanel({ flow, email, headingRef, children }: CheckEmailPanelProps) {
  return (
    <section className="auth-panel">
      <h1 className="auth-panel__title" tabIndex={-1} ref={headingRef}>
        {flow === "verification" ? "Cek email Anda" : "Periksa email Anda"}
      </h1>
      {flow === "verification" ? (
        <p className="auth-panel__body">
          Kami mengirimkan tautan verifikasi ke{" "}
          <strong>{email ?? "email Anda"}</strong>. Tautan berlaku 24 jam.
        </p>
      ) : (
        <p className="auth-panel__body">
          Jika akun dengan email tersebut terdaftar, tautan pemulihan telah
          dikirim ke email Anda. Tautan berlaku 1 jam.
        </p>
      )}
      {flow === "verification" ? (
        <p className="auth-panel__note">
          Buka aplikasi email Anda, lalu pilih tautan verifikasi untuk
          mengaktifkan akun.
        </p>
      ) : null}
      {children}
    </section>
  );
}
