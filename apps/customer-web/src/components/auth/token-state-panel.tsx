import Link from "next/link";
import type { RefObject } from "react";

type TokenStatePanelProps = {
  kind: "expired" | "invalid";
  flow: "verification" | "reset";
  /** Attached to the h1 so a client form can move focus after a swap. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
};

/**
 * Landing state for expired / invalid email links (design plan §3 rows 7–8).
 * Distinct copy per flow so a legitimate token holder learns *why* it failed;
 * both states are reachable only by link holders, so nothing is leaked.
 * The token itself is never rendered.
 */
export function TokenStatePanel({ kind, flow, headingRef }: TokenStatePanelProps) {
  const ttl = flow === "verification" ? "24 jam" : "1 jam";
  const flowName = flow === "verification" ? "verifikasi" : "pemulihan";

  return (
    <section className="auth-panel">
      <h1 className="auth-panel__title" tabIndex={-1} ref={headingRef}>
        {kind === "expired" ? "Tautan kedaluwarsa" : "Tautan tidak valid"}
      </h1>
      {kind === "expired" ? (
        <p className="auth-panel__body">
          Tautan {flowName} berlaku {ttl} dan masa berlakunya sudah berakhir.
          Minta tautan baru, lalu buka email Anda.
        </p>
      ) : (
        <p className="auth-panel__body">
          Tautan {flowName} sudah pernah digunakan atau tidak dikenali.
        </p>
      )}
      <div className="auth-panel__actions">
        {kind === "expired" && flow === "verification" ? (
          <Link className="ui-button ui-button--primary ui-button--md" href="/verifikasi">
            Kirim ulang tautan
          </Link>
        ) : null}
        {flow === "reset" ? (
          <Link className="ui-button ui-button--primary ui-button--md" href="/lupa-sandi">
            Minta tautan baru
          </Link>
        ) : null}
        {kind === "invalid" && flow === "verification" ? (
          <Link className="ui-button ui-button--primary ui-button--md" href="/masuk">
            Masuk
          </Link>
        ) : null}
      </div>
      {kind === "invalid" && flow === "verification" ? (
        <div className="auth-links">
          <Link href="/lupa-sandi">Lupa kata sandi?</Link>
        </div>
      ) : null}
    </section>
  );
}
