import { beforeAll, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWTVerifyGetKey } from "jose";
import {
  createGoogleOAuthTransaction,
  exchangeGoogleCode,
  googleAuthorizationUrl,
  matchesOAuthState,
  readGoogleOAuthConfig,
  verifyGoogleIdentityToken,
  type GoogleOAuthConfig,
} from "./google-oauth";

const CLIENT_ID = "wedding-system-google-client";
const NONCE = `nonce-${"a".repeat(32)}`;
const config: GoogleOAuthConfig = {
  clientId: CLIENT_ID,
  clientSecret: "test-client-secret",
  redirectUri: "https://wedding.example/api/auth/google/callback",
};

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let getKey: JWTVerifyGetKey;

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256", { modulusLength: 2048 });
  privateKey = keyPair.privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  getKey = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: "google-test-key", alg: "RS256", use: "sig" }],
  });
});

async function signedIdentityToken(
  input: {
    claims?: Record<string, unknown>;
    audience?: string | string[];
    issuer?: string;
    omitExpiration?: boolean;
  } = {},
): Promise<string> {
  let token = new SignJWT({
    sub: "google-sub-123",
    email: "RANI@example.com",
    email_verified: true,
    nonce: NONCE,
    name: "Rani Pratama",
    ...input.claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "google-test-key" })
    .setIssuer(input.issuer ?? "https://accounts.google.com")
    .setAudience(input.audience ?? CLIENT_ID)
    .setIssuedAt();
  if (!input.omitExpiration) token = token.setExpirationTime("5m");
  return token.sign(privateKey);
}

describe("Google OAuth configuration", () => {
  it("accepts HTTPS callback URLs and local HTTP only in development", () => {
    expect(
      readGoogleOAuthConfig({
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_OAUTH_REDIRECT_URI: config.redirectUri,
      }),
    ).toMatchObject({ clientId: CLIENT_ID, redirectUri: config.redirectUri });

    expect(
      readGoogleOAuthConfig({
        NODE_ENV: "development",
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_OAUTH_REDIRECT_URI:
          "http://localhost:3000/api/auth/google/callback",
      }),
    ).not.toBeNull();
  });

  it("rejects insecure production callbacks and non-callback paths", () => {
    expect(
      readGoogleOAuthConfig({
        NODE_ENV: "production",
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_OAUTH_REDIRECT_URI:
          "http://localhost:3000/api/auth/google/callback",
      }),
    ).toBeNull();
    expect(
      readGoogleOAuthConfig({
        NODE_ENV: "development",
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_OAUTH_REDIRECT_URI: "https://wedding.example/other",
      }),
    ).toBeNull();
  });
});

describe("Google OAuth transaction", () => {
  it("creates random state, nonce, and PKCE values for the authorization URL", () => {
    const transaction = createGoogleOAuthTransaction();
    const url = googleAuthorizationUrl(config, transaction);

    expect(transaction.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(transaction.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("state")).toBe(transaction.state);
    expect(url.searchParams.get("nonce")).toBe(transaction.nonce);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).not.toBe(
      transaction.verifier,
    );
  });

  it("compares OAuth state without accepting malformed values", () => {
    const state = createGoogleOAuthTransaction().state;
    expect(matchesOAuthState(state, state)).toBe(true);
    expect(matchesOAuthState(state, `${state.slice(0, -1)}A`)).toBe(false);
    expect(matchesOAuthState(undefined, state)).toBe(false);
    expect(matchesOAuthState(state, null)).toBe(false);
  });
});

describe("Google token exchange", () => {
  it("sends the authorization code and PKCE verifier only to Google's token endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ id_token: "signed-id-token-value-1234567890" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(
      exchangeGoogleCode({
        code: "authorization-code",
        verifier: "pkce-verifier",
        config,
        fetcher,
      }),
    ).resolves.toBe("signed-id-token-value-1234567890");
    expect(fetcher).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        body: expect.any(URLSearchParams),
      }),
    );
  });

  it("rejects failed or malformed token responses", async () => {
    const failedFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 400 }));
    await expect(
      exchangeGoogleCode({
        code: "authorization-code",
        verifier: "pkce-verifier",
        config,
        fetcher: failedFetcher,
      }),
    ).rejects.toThrow("Google token exchange failed");

    const malformedFetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "no-id-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      exchangeGoogleCode({
        code: "authorization-code",
        verifier: "pkce-verifier",
        config,
        fetcher: malformedFetcher,
      }),
    ).rejects.toThrow("Google token response is invalid");
  });
});

describe("Google ID token verification", () => {
  it("verifies signature, issuer, audience, nonce, and verified email", async () => {
    const token = await signedIdentityToken();

    await expect(
      verifyGoogleIdentityToken(
        token,
        { clientId: CLIENT_ID, nonce: NONCE },
        getKey,
      ),
    ).resolves.toEqual({
      providerAccountId: "google-sub-123",
      email: "rani@example.com",
      displayName: "Rani Pratama",
    });
  });

  it("rejects unverified email, nonce mismatch, wrong audience, and wrong issuer", async () => {
    const unverified = await signedIdentityToken({
      claims: { email_verified: false },
    });
    const wrongNonce = await signedIdentityToken({
      claims: { nonce: `nonce-${"b".repeat(32)}` },
    });
    const wrongAudience = await signedIdentityToken({
      audience: "another-client",
    });
    const wrongIssuer = await signedIdentityToken({
      issuer: "https://evil.example",
    });
    const missingExpiration = await signedIdentityToken({
      omitExpiration: true,
    });
    const multipleAudiencesWithoutAuthorizedParty = await signedIdentityToken({
      audience: [CLIENT_ID, "another-client"],
    });
    const multipleAudiencesWithWrongAuthorizedParty = await signedIdentityToken(
      {
        audience: [CLIENT_ID, "another-client"],
        claims: { azp: "another-client" },
      },
    );

    await expect(
      verifyGoogleIdentityToken(
        unverified,
        { clientId: CLIENT_ID, nonce: NONCE },
        getKey,
      ),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIdentityToken(
        wrongNonce,
        { clientId: CLIENT_ID, nonce: NONCE },
        getKey,
      ),
    ).rejects.toThrow("Google identity claims are invalid");
    await expect(
      verifyGoogleIdentityToken(
        wrongAudience,
        { clientId: CLIENT_ID, nonce: NONCE },
        getKey,
      ),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIdentityToken(
        wrongIssuer,
        { clientId: CLIENT_ID, nonce: NONCE },
        getKey,
      ),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIdentityToken(
        missingExpiration,
        { clientId: CLIENT_ID, nonce: NONCE },
        getKey,
      ),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIdentityToken(
        multipleAudiencesWithoutAuthorizedParty,
        { clientId: CLIENT_ID, nonce: NONCE },
        getKey,
      ),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIdentityToken(
        multipleAudiencesWithWrongAuthorizedParty,
        { clientId: CLIENT_ID, nonce: NONCE },
        getKey,
      ),
    ).rejects.toThrow("Google authorized party is invalid");
  });
});
