/**
 * Safe post-auth redirect validator for the admin console.
 *
 * The console has exactly one entry point, so a `next` target is honored only
 * when it resolves to `/` itself (optionally with a query string, e.g.
 * `/?page=2`). Everything else — protocol-relative paths, backslashes, encoded
 * separators, absolute URLs, other routes — silently falls back to the console
 * root. The client's copy of `next` is never trusted; this runs again inside
 * the server action before any redirect.
 */

export const ADMIN_DEFAULT_REDIRECT = "/";

const BASE = "http://admin.local";

export function safeAdminRedirectTarget(
  next: string | null | undefined,
): string {
  if (!next) return ADMIN_DEFAULT_REDIRECT;

  const value = next.trim();
  if (value === "") return ADMIN_DEFAULT_REDIRECT;

  // Reject protocol-relative and backslash tricks before any URL parsing.
  if (value.startsWith("//") || value.includes("\\")) {
    return ADMIN_DEFAULT_REDIRECT;
  }
  // Reject anything that is not plainly a relative path.
  if (!value.startsWith("/")) return ADMIN_DEFAULT_REDIRECT;
  // Reject control characters and whitespace smuggled inside the param.
  if (/[\u0000-\u001F\u007F]/.test(value)) return ADMIN_DEFAULT_REDIRECT;

  let parsed: URL;
  try {
    parsed = new URL(value, BASE);
  } catch {
    return ADMIN_DEFAULT_REDIRECT;
  }

  // Same-origin only (scheme/host must not have escaped the base).
  if (parsed.origin !== BASE) return ADMIN_DEFAULT_REDIRECT;

  // Encoded separators could normalize into an authority separator later.
  let decoded: string;
  try {
    decoded = decodeURIComponent(parsed.pathname);
  } catch {
    return ADMIN_DEFAULT_REDIRECT;
  }
  if (decoded !== "/") return ADMIN_DEFAULT_REDIRECT;

  // Rebuild from validated pathname + search only (drops credentials, fragment,
  // and any encoded host); keeps console query params like ?page=.
  return `${parsed.pathname}${parsed.search}`;
}
