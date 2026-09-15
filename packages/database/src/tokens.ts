import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_TOKEN_BYTES = 32;
const TOKEN_HASH_ENCODING = "hex";

export type OpaqueToken = Readonly<{
  value: string;
  hash: string;
}>;

export function generateOpaqueToken(): OpaqueToken {
  const value = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  return { value, hash: hashToken(value) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest(TOKEN_HASH_ENCODING);
}

export function verifyToken(token: string, expectedHash: string): boolean {
  const actualHash = Buffer.from(hashToken(token), TOKEN_HASH_ENCODING);
  const expected = Buffer.from(expectedHash, TOKEN_HASH_ENCODING);

  if (actualHash.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expected);
}

export function generateSessionToken(): OpaqueToken {
  return generateOpaqueToken();
}

export function hashSessionToken(token: string): string {
  return hashToken(token);
}

export function verifySessionToken(
  token: string,
  expectedHash: string,
): boolean {
  return verifyToken(token, expectedHash);
}
