/**
 * Resolves the public origin used in verification and password-reset links.
 *
 * A localhost fallback is correct for development and catastrophic in
 * production: the email would be delivered with a link that cannot work. The
 * production case therefore has no fallback — callers fail closed and the
 * request/resend actions report their usual anti-enumeration success without
 * sending a broken link.
 */
export class AuthAppUrlError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AuthAppUrlError";
  }
}

const DEVELOPMENT_APP_URL = "http://localhost:3000";

export function resolveAuthAppUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = (env.APP_URL ?? env.NEXT_PUBLIC_SITE_URL)?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }

  if ((env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new AuthAppUrlError(
      "APP_URL is required in production so auth links point at the public origin.",
    );
  }

  return DEVELOPMENT_APP_URL;
}
