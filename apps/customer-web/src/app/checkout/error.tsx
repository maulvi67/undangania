"use client";

import { useEffect } from "react";
import { LinkButton } from "../../components/marketing/link-button";
import "./checkout.css";

export default function CheckoutError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The production error boundary should report only a redacted digest;
    // fixture checkout does not log order or provider data in the browser.
  }, []);

  return (
    <main className="ck-page">
      <div className="ui-container">
        <div className="ck-status-layout">
          <header className="ck-heading ck-heading--status">
            <p className="ck-eyebrow">Pesanan</p>
            <h1 className="ck-title">Rincian pesanan belum dapat dimuat</h1>
            <p className="ck-lede">
              Pesanan Anda tidak dianggap berubah. Silakan coba lagi atau
              kembali ke katalog desain.
            </p>
          </header>
          <div className="ck-status__actions">
            <button
              className="ui-button ui-button--primary ui-button--lg"
              type="button"
              onClick={reset}
            >
              Coba lagi
            </button>
            <LinkButton href="/templates" variant="secondary">
              Kembali ke katalog
            </LinkButton>
          </div>
        </div>
      </div>
    </main>
  );
}
