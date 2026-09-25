import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { normalizeEmail } from "./contract";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
const GOOGLE_OAUTH_TTL_SECONDS = 10 * 60;
const GOOGLE_TOKEN_TIMEOUT_MS = 10_000;

const googleJwks = createRemoteJWKSet(GOOGLE_JWKS_URL, {
  timeoutDuration: GOOGLE_TOKEN_TIMEOUT_MS,
  cooldownDuration: 30_000,
  cacheMaxAge: 10 * 60_000,
});

const googleTokenResponseSchema = z.object({
  id_token: z.string().min(32).max(8192),
});

const googleIdentityClaimsSchema = z.object({
  sub: z.string().min(1).max(255),
  aud: z.union([z.string(), z.array(z.string()).min(1)]),
  azp: z.string().optional(),
  email: z.string().email().max(254),
  email_verified: z.literal(true),
  nonce: z.string().min(32).max(128),
  name: z.string().trim().min(1).max(150).optional(),
});

export type GoogleOAuthConfig = Readonly<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}>;

export type GoogleOAuthTransaction = Readonly<{
  state: string;
  nonce: string;
  verifier: string;
}>;

export type GoogleIdentity = Readonly<{
  providerAccountId: string;
  email: string;
  displayName: string;
}>;

export function readGoogleOAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GoogleOAuthConfig | null {
  const clientId = environment.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim();
  const rawRedirectUri = environment.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !rawRedirectUri) return null;

  let redirectUri: URL;
  try {
    redirectUri = new URL(rawRedirectUri);
  } catch {
    return null;
  }

  const isLocalHttp =
    environment.NODE_ENV !== "production" &&
    redirectUri.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(redirectUri.hostname);
  if (
    (redirectUri.protocol !== "https:" && !isLocalHttp) ||
    redirectUri.pathname !== GOOGLE_CALLBACK_PATH ||
    redirectUri.username !== "" ||
    redirectUri.password !== "" ||
    redirectUri.search !== "" ||
    redirectUri.hash !== ""
  ) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: redirectUri.toString(),
  };
}

export function createGoogleOAuthTransaction(): GoogleOAuthTransaction {
  return {
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
  };
}

export function googleAuthorizationUrl(
  config: GoogleOAuthConfig,
  transaction: GoogleOAuthTransaction,
): URL {
  const challenge = createHash("sha256")
    .update(transaction.verifier)
    .digest("base64url");
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("nonce", transaction.nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export function matchesOAuthState(
  expected: string | undefined,
  received: string | null,
): boolean {
  if (
    expected === undefined ||
    received === null ||
    !/^[A-Za-z0-9_-]{43}$/.test(expected) ||
    !/^[A-Za-z0-9_-]{43}$/.test(received)
  ) {
    return false;
  }
  const expectedBytes = Buffer.from(expected, "base64url");
  const receivedBytes = Buffer.from(received, "base64url");
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export async function exchangeGoogleCode(input: {
  code: string;
  verifier: string;
  config: GoogleOAuthConfig;
  fetcher?: typeof fetch;
}): Promise<string> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    credentials: "omit",
    redirect: "error",
    body: new URLSearchParams({
      code: input.code,
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      redirect_uri: input.config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.verifier,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(GOOGLE_TOKEN_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Google token exchange failed");

  const parsed = googleTokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Google token response is invalid");
  return parsed.data.id_token;
}

export async function verifyGoogleIdentityToken(
  token: string,
  input: { clientId: string; nonce: string },
  getKey: JWTVerifyGetKey = googleJwks,
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(token, getKey, {
    algorithms: ["RS256"],
    audience: input.clientId,
    issuer: GOOGLE_ISSUERS,
    requiredClaims: ["exp", "iat", "iss", "aud", "sub"],
    maxTokenAge: "10 minutes",
    clockTolerance: 5,
  });
  const parsed = googleIdentityClaimsSchema.safeParse(payload);
  if (!parsed.success || parsed.data.nonce !== input.nonce) {
    throw new Error("Google identity claims are invalid");
  }
  const audiences = Array.isArray(parsed.data.aud)
    ? parsed.data.aud
    : [parsed.data.aud];
  if (
    (parsed.data.azp !== undefined && parsed.data.azp !== input.clientId) ||
    (audiences.length > 1 && parsed.data.azp !== input.clientId)
  ) {
    throw new Error("Google authorized party is invalid");
  }

  return {
    providerAccountId: parsed.data.sub,
    email: normalizeEmail(parsed.data.email),
    displayName:
      parsed.data.name?.trim() || parsed.data.email.split("@")[0] || "Pengguna",
  };
}

export const GOOGLE_OAUTH_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_OAUTH_TTL = GOOGLE_OAUTH_TTL_SECONDS;
export const GOOGLE_OAUTH_COOKIES = {
  state: "ws_oauth_state",
  nonce: "ws_oauth_nonce",
  verifier: "ws_oauth_verifier",
  next: "ws_oauth_next",
} as const;
