/**
 * Safe post-auth redirect validator (MVP-UI-005, design plan §5).
 *
 * The `next` parameter is only ever honored after server-side validation:
 * same-origin path, on the app-internal allowlist, with the classic
 * open-redirect bypasses rejected. Everything else silently falls back to
 * DEFAULT_REDIRECT — never an error page (an invalid `next` is the user's
 * context, not their fault).
 */

export const DEFAULT_REDIRECT = "/";

/** App-internal destinations a post-auth redirect may target (D3: "/" until /dashboard exists). */
const ALLOWED_DESTINATIONS = [
  "/",
  "/templates",
  "/masuk",
  "/daftar",
  "/verifikasi",
  "/lupa-sandi",
  "/reset-sandi",
  "/sesi-berakhir",
] as const;

const BASE = "http://auth.local";

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_DESTINATIONS.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  );
}

export function safeRedirectTarget(next: string | null | undefined): string {
  if (!next) return DEFAULT_REDIRECT;

  const value = next.trim();
  if (value === "") return DEFAULT_REDIRECT;

  // Reject protocol-relative and backslash tricks before any URL parsing.
  if (value.startsWith("//") || value.startsWith("/\\") || value.includes("\\")) {
    return DEFAULT_REDIRECT;
  }
  // Reject anything that is not plainly a relative path.
  if (!value.startsWith("/")) return DEFAULT_REDIRECT;
  // Reject control characters and whitespace smuggled inside the param.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(value)) return DEFAULT_REDIRECT;

  let parsed: URL;
  try {
    parsed = new URL(value, BASE);
  } catch {
    return DEFAULT_REDIRECT;
  }

  // Same-origin only (scheme/host must not have escaped the base).
  if (parsed.origin !== BASE) return DEFAULT_REDIRECT;

  // Double-decoded path check: browsers differ on %2F handling; a decoded
  // "//" or "/\" prefix would become protocol-relative after normalization.
  let decoded: string;
  try {
    decoded = decodeURIComponent(parsed.pathname);
  } catch {
    return DEFAULT_REDIRECT;
  }
  // No double slashes or backslashes anywhere after decoding — proxies and
  // browsers may re-normalize them into authority separators.
  if (decoded.includes("//") || decoded.includes("\\")) return DEFAULT_REDIRECT;

  if (!isAllowedPath(parsed.pathname) || !isAllowedPath(decoded)) return DEFAULT_REDIRECT;

  // Rebuild from validated pathname + search only (drops credentials,
  // fragment, and any encoded host); keep in-app query params like ?q=.
  return `${parsed.pathname}${parsed.search}`;
}

/** Builds a "/masuk?next=…" href (used by cross-links that carry context). */
export function signInHref(next?: string | null): string {
  const target = safeRedirectTarget(next);
  if (target === DEFAULT_REDIRECT || target === "/") return "/masuk";
  return `/masuk?next=${encodeURIComponent(target)}`;
}
