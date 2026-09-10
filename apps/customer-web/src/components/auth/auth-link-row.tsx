import type { ReactNode } from "react";

/**
 * The single cross-link row under every auth form (one place, consistent
 * order, keyboard reachable after the submit button).
 */
export function AuthLinkRow({ children }: { children: ReactNode }) {
  return <div className="auth-links">{children}</div>;
}
