import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleAndCreateSession } from "../../../../../lib/auth/server";
import {
  exchangeGoogleCode,
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_COOKIES,
  matchesOAuthState,
  readGoogleOAuthConfig,
  verifyGoogleIdentityToken,
} from "../../../../../lib/auth/google-oauth";
import {
  DEFAULT_REDIRECT,
  safeRedirectTarget,
} from "../../../../../lib/auth/redirect";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: GOOGLE_OAUTH_COOKIE_PATH,
    maxAge: 0,
  };
}

function redirectResult(
  origin: string | null,
  destination: string,
  oauthError?: "failed" | "unavailable",
): NextResponse {
  let target = destination;
  if (oauthError !== undefined) {
    const login = new URL("/masuk", origin ?? "http://auth.local");
    login.searchParams.set("oauth", oauthError);
    if (destination !== DEFAULT_REDIRECT) {
      login.searchParams.set("next", destination);
    }
    target = `${login.pathname}${login.search}`;
  }

  const location =
    origin === null ? target : new URL(target, origin).toString();
  const response = new NextResponse(null, {
    status: 302,
    headers: { Location: location },
  });
  response.headers.set("Cache-Control", "private, no-store");
  for (const name of Object.values(GOOGLE_OAUTH_COOKIES)) {
    response.cookies.set(name, "", cookieOptions());
  }
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = readGoogleOAuthConfig();
  const origin = config ? new URL(config.redirectUri).origin : null;
  const rawNext = request.cookies.get(GOOGLE_OAUTH_COOKIES.next)?.value;
  const next =
    rawNext === undefined || rawNext.length > 2048
      ? DEFAULT_REDIRECT
      : safeRedirectTarget(rawNext);
  const state = request.cookies.get(GOOGLE_OAUTH_COOKIES.state)?.value;
  const nonce = request.cookies.get(GOOGLE_OAUTH_COOKIES.nonce)?.value;
  const verifier = request.cookies.get(GOOGLE_OAUTH_COOKIES.verifier)?.value;

  if (
    config === null ||
    !matchesOAuthState(state, request.nextUrl.searchParams.get("state")) ||
    nonce === undefined ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
    verifier === undefined ||
    !/^[A-Za-z0-9_-]{43}$/.test(verifier)
  ) {
    return redirectResult(origin, next, "unavailable");
  }

  const providerError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  if (
    providerError !== null ||
    code === null ||
    code.length === 0 ||
    code.length > 2048 ||
    /[\u0000-\u0020\u007f]/.test(code)
  ) {
    return redirectResult(origin, next, "failed");
  }

  try {
    const idToken = await exchangeGoogleCode({ code, verifier, config });
    const identity = await verifyGoogleIdentityToken(idToken, {
      clientId: config.clientId,
      nonce,
    });
    const result = await authenticateGoogleAndCreateSession(identity);
    if (!result.ok) return redirectResult(origin, next, "failed");
    return redirectResult(origin, next);
  } catch {
    return redirectResult(origin, next, "failed");
  }
}
