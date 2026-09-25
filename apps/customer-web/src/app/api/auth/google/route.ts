import { NextRequest, NextResponse } from "next/server";
import {
  createGoogleOAuthTransaction,
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_COOKIES,
  GOOGLE_OAUTH_TTL,
  googleAuthorizationUrl,
  readGoogleOAuthConfig,
} from "../../../../lib/auth/google-oauth";
import {
  DEFAULT_REDIRECT,
  safeRedirectTarget,
} from "../../../../lib/auth/redirect";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: GOOGLE_OAUTH_COOKIE_PATH,
    maxAge,
  };
}

function unavailable(request: NextRequest, next: string): NextResponse {
  const login = new URL("/masuk", request.url);
  login.searchParams.set("oauth", "unavailable");
  if (next !== DEFAULT_REDIRECT) login.searchParams.set("next", next);

  const response = new NextResponse(null, {
    status: 302,
    headers: { Location: `${login.pathname}${login.search}` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  for (const name of Object.values(GOOGLE_OAUTH_COOKIES)) {
    response.cookies.set(name, "", cookieOptions(0));
  }
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawNext = request.nextUrl.searchParams.get("next");
  const next =
    rawNext === null || rawNext.length > 2048
      ? DEFAULT_REDIRECT
      : safeRedirectTarget(rawNext);
  const config = readGoogleOAuthConfig();
  if (config === null) return unavailable(request, next);

  const transaction = createGoogleOAuthTransaction();
  const response = NextResponse.redirect(
    googleAuthorizationUrl(config, transaction),
    302,
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(
    GOOGLE_OAUTH_COOKIES.state,
    transaction.state,
    cookieOptions(GOOGLE_OAUTH_TTL),
  );
  response.cookies.set(
    GOOGLE_OAUTH_COOKIES.nonce,
    transaction.nonce,
    cookieOptions(GOOGLE_OAUTH_TTL),
  );
  response.cookies.set(
    GOOGLE_OAUTH_COOKIES.verifier,
    transaction.verifier,
    cookieOptions(GOOGLE_OAUTH_TTL),
  );
  response.cookies.set(
    GOOGLE_OAUTH_COOKIES.next,
    next,
    cookieOptions(GOOGLE_OAUTH_TTL),
  );
  return response;
}
