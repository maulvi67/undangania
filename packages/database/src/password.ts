import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const PASSWORD_HASH_ALGORITHM = "scrypt";
const PASSWORD_HASH_VERSION = 1;
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 32;
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;
const PASSWORD_HASH_MAX_LENGTH = 255;

const scryptOptions: ScryptOptions = {
  N: SCRYPT_COST,
  r: SCRYPT_BLOCK_SIZE,
  p: SCRYPT_PARALLELIZATION,
  maxmem: SCRYPT_MAX_MEMORY,
};

export const PASSWORD_HASH_FORMAT =
  "$scrypt$v=1$N=16384,r=8,p=1$<salt>$<digest>";

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      DERIVED_KEY_BYTES,
      scryptOptions,
      (error, derivedKey) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function decodeBase64Url(value: string): Buffer | null {
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

type ParsedPasswordHash = Readonly<{
  salt: Buffer;
  digest: Buffer;
}>;

function parsePasswordHash(encodedHash: string): ParsedPasswordHash | null {
  if (encodedHash.length > PASSWORD_HASH_MAX_LENGTH) {
    return null;
  }

  const match =
    /^\$scrypt\$v=(\d+)\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(
      encodedHash,
    );
  if (match === null) {
    return null;
  }

  const [
    ,
    version,
    cost,
    blockSize,
    parallelization,
    encodedSalt,
    encodedDigest,
  ] = match;
  if (
    version !== String(PASSWORD_HASH_VERSION) ||
    cost !== String(SCRYPT_COST) ||
    blockSize !== String(SCRYPT_BLOCK_SIZE) ||
    parallelization !== String(SCRYPT_PARALLELIZATION) ||
    encodedSalt === undefined ||
    encodedDigest === undefined
  ) {
    return null;
  }

  const salt = decodeBase64Url(encodedSalt);
  const digest = decodeBase64Url(encodedDigest);
  if (
    salt === null ||
    digest === null ||
    salt.length !== SALT_BYTES ||
    digest.length !== DERIVED_KEY_BYTES
  ) {
    return null;
  }

  return { salt, digest };
}

/**
 * Encodes a password with the package's versioned scrypt format.
 *
 * The returned value is deliberately bounded well below User.passwordHash's
 * VarChar(255) limit and contains no raw password material.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const digest = await deriveKey(password, salt);
  const encodedHash = [
    `$${PASSWORD_HASH_ALGORITHM}$v=${PASSWORD_HASH_VERSION}$N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELIZATION}`,
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");

  if (encodedHash.length > PASSWORD_HASH_MAX_LENGTH) {
    throw new Error("Password hash exceeds the database storage limit");
  }

  return encodedHash;
}

/**
 * Verifies a password against a supported encoded hash.
 *
 * Unknown versions, unsupported parameters, and malformed values are treated
 * as non-matches so a stored value cannot select an unsafe work factor.
 */
export function isPasswordHash(encodedHash: string): boolean {
  return parsePasswordHash(encodedHash) !== null;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash);
  if (parsed === null) {
    return false;
  }

  try {
    const actualDigest = await deriveKey(password, parsed.salt);
    return timingSafeEqual(actualDigest, parsed.digest);
  } catch {
    return false;
  }
}
