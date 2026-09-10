import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Shared shell for every auth screen (MVP-UI-005): skip link → main →
 * small logo home → one centered card. No marketing header — one job
 * per screen, nothing competing for attention.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <main id="konten-utama" tabIndex={-1} className="auth-main">
        <div className="auth-card">
          <Link className="auth-logo" href="/">
            Wedding System
          </Link>
          {children}
        </div>
      </main>
      <p className="auth-legal">
        &copy; {new Date().getFullYear()} Wedding System. Undangan digital untuk hari bahagia Anda.
      </p>
    </div>
  );
}
