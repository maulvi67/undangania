import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_COOKIES,
  GOOGLE_OAUTH_TTL,
} from "../../../../lib/auth/google-oauth";
import { GET as callback } from "./callback/route";
import { GET as start } from "./route";

describe("Google OAuth unavailable redirects", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_OAUTH_REDIRECT_URI", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps start redirects relative when the request host is untrusted", async () => {
    const request = new NextRequest(
      "https://untrusted.example/api/auth/google?next=%2Ftemplates",
    );

    const response = await start(request);

    expect(response.headers.get("location")).toBe(
      "/masuk?oauth=unavailable&next=%2Ftemplates",
    );
  });

  it("stores protected transaction cookies before redirecting to Google", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "server-secret");
    vi.stubEnv(
      "GOOGLE_OAUTH_REDIRECT_URI",
      "https://wedding.example/api/auth/google/callback",
    );
    const request = new NextRequest(
      "https://wedding.example/api/auth/google?next=%2Ftemplates",
    );

    const response = await start(request);
    const authorizationUrl = new URL(response.headers.get("location") ?? "");

    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(response.cookies.get(GOOGLE_OAUTH_COOKIES.state)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: GOOGLE_OAUTH_COOKIE_PATH,
      maxAge: GOOGLE_OAUTH_TTL,
    });
    expect(response.cookies.get(GOOGLE_OAUTH_COOKIES.next)?.value).toBe(
      "/templates",
    );
  });

  it("keeps callback redirects relative when OAuth is misconfigured", async () => {
    const request = new NextRequest(
      "https://untrusted.example/api/auth/google/callback",
    );
    request.cookies.set("ws_oauth_next", "/templates");

    const response = await callback(request);

    expect(response.headers.get("location")).toBe(
      "/masuk?oauth=unavailable&next=%2Ftemplates",
    );
  });
});
