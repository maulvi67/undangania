import { createHash, createHmac } from "node:crypto";

export interface StoragePort {
  createUpload(input: {
    tenantId: string;
    objectKey: string;
    contentType: string;
    maxBytes: number;
    contentLength?: number;
  }): Promise<{ url: string; expiresAt: string }>;
  delete(objectKey: string): Promise<void>;
  headObject(objectKey: string): Promise<StorageObjectMetadata>;
  readPrefix(
    input: Readonly<{
      tenantId: string;
      objectKey: string;
      maxBytes: number;
    }>,
  ): Promise<Uint8Array>;
  createReadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
}

export type StorageObjectMetadata = Readonly<{
  contentLength: number | null;
  contentType: string | null;
  etag: string | null;
}>;

export type StorageFetchResponse = Readonly<{
  ok: boolean;
  status: number;
  headers: Readonly<{
    get(name: string): string | null;
  }>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export type StorageFetch = (
  input: string,
  init: Readonly<{
    method: "GET" | "HEAD" | "DELETE";
    headers?: Readonly<Record<string, string>>;
  }>,
) => Promise<StorageFetchResponse>;

export type R2StorageAdapterOptions = Readonly<{
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  uploadExpiresInSeconds?: number;
  readExpiresInSeconds?: number;
  fetch?: StorageFetch;
  now?: () => Date;
}>;

export const DEFAULT_UPLOAD_EXPIRES_IN_SECONDS = 15 * 60;
export const DEFAULT_READ_EXPIRES_IN_SECONDS = 5 * 60;
export const MAX_SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;
export const MAX_OBJECT_PREFIX_BYTES = 64 * 1024;
const INTERNAL_REQUEST_EXPIRES_IN_SECONDS = 60;
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_TERMINATOR = "aws4_request";
const AWS_REGION = "auto";
const AWS_SERVICE = "s3";

const DEFAULT_FETCH: StorageFetch = async (input, init) =>
  fetch(
    input,
    init.headers === undefined
      ? { method: init.method }
      : { method: init.method, headers: init.headers },
  );

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function awsEncodePath(value: string): string {
  return value
    .split("/")
    .map((segment) => awsEncode(segment))
    .join("/");
}

function normalizeHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validateExpiration(value: number, name: string): number {
  if (
    !isPositiveSafeInteger(value) ||
    value > MAX_SIGNED_URL_EXPIRES_IN_SECONDS
  ) {
    throw new Error(
      `${name} must be a positive integer no greater than ${MAX_SIGNED_URL_EXPIRES_IN_SECONDS} seconds`,
    );
  }
  return value;
}

function validateEndpoint(endpoint: string): string {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("Storage endpoint must be a valid HTTPS URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Storage endpoint must use HTTPS");
  }
  if (parsed.hostname.length === 0) {
    throw new Error("Storage endpoint must include a hostname");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("Storage endpoint must not contain credentials");
  }
  if (parsed.search !== "" || parsed.hash !== "") {
    throw new Error("Storage endpoint must not contain a query or fragment");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function requireNonBlank(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${name} must not be blank`);
  }
  return normalized;
}

function dateParts(now: Date): Readonly<{
  shortDate: string;
  amzDate: string;
}> {
  if (Number.isNaN(now.getTime())) throw new Error("Storage clock is invalid");
  const iso = now.toISOString();
  return {
    shortDate: iso.slice(0, 10).replace(/-/g, ""),
    amzDate: `${iso.slice(0, 19).replace(/[-:]/g, "")}Z`,
  };
}

function objectPath(
  endpoint: string,
  bucket: string,
  objectKey: string,
): string {
  const parsed = new URL(endpoint);
  const prefix =
    parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
  return `${prefix}/${awsEncode(bucket)}/${awsEncodePath(objectKey)}`;
}

function canonicalQuery(
  values: ReadonlyArray<readonly [string, string]>,
): string {
  return values
    .map(([key, value]) => [awsEncode(key), awsEncode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function signingKey(secretAccessKey: string, shortDate: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, shortDate);
  const regionKey = hmac(dateKey, AWS_REGION);
  const serviceKey = hmac(regionKey, AWS_SERVICE);
  return hmac(serviceKey, AWS_TERMINATOR);
}

function presignedUrl(input: {
  endpoint: string;
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  method: "GET" | "HEAD" | "DELETE" | "PUT";
  expiresInSeconds: number;
  contentType?: string;
  now: Date;
}): string {
  const { shortDate, amzDate } = dateParts(input.now);
  const parsedEndpoint = new URL(input.endpoint);
  const host = parsedEndpoint.host;
  const uri = objectPath(input.endpoint, input.bucket, input.objectKey);
  const headers = [
    ["host", host] as const,
    ...(input.contentType === undefined
      ? []
      : [["content-type", normalizeHeaderValue(input.contentType)] as const]),
  ].sort(([left], [right]) => left.localeCompare(right));
  const signedHeaders = headers.map(([name]) => name).join(";");
  const canonicalHeaders = `${headers
    .map(([name, value]) => `${name}:${value}`)
    .join("\n")}\n`;
  const credentialScope = `${shortDate}/${AWS_REGION}/${AWS_SERVICE}/${AWS_TERMINATOR}`;
  const query = canonicalQuery([
    ["X-Amz-Algorithm", AWS_ALGORITHM],
    ["X-Amz-Credential", `${input.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(input.expiresInSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ]);
  const canonicalRequest = [
    input.method,
    uri,
    query,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    AWS_ALGORITHM,
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = hmac(
    signingKey(input.secretAccessKey, shortDate),
    stringToSign,
  ).toString("hex");

  return `${parsedEndpoint.origin}${uri}?${query}&X-Amz-Signature=${signature}`;
}

export class R2StorageAdapter implements StoragePort {
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly uploadExpiresInSeconds: number;
  private readonly readExpiresInSeconds: number;
  private readonly fetcher: StorageFetch;
  private readonly now: () => Date;

  public constructor(options: R2StorageAdapterOptions) {
    this.endpoint = validateEndpoint(
      requireNonBlank(options.endpoint, "Storage endpoint"),
    );
    this.bucket = requireNonBlank(options.bucket, "Storage bucket");
    this.accessKeyId = requireNonBlank(
      options.accessKeyId,
      "Storage access key ID",
    );
    this.secretAccessKey = requireNonBlank(
      options.secretAccessKey,
      "Storage secret access key",
    );
    this.uploadExpiresInSeconds = validateExpiration(
      options.uploadExpiresInSeconds ?? DEFAULT_UPLOAD_EXPIRES_IN_SECONDS,
      "Upload URL expiration",
    );
    this.readExpiresInSeconds = validateExpiration(
      options.readExpiresInSeconds ?? DEFAULT_READ_EXPIRES_IN_SECONDS,
      "Read URL expiration",
    );
    this.fetcher = options.fetch ?? DEFAULT_FETCH;
    this.now = options.now ?? (() => new Date());
  }

  public async createUpload(input: {
    tenantId: string;
    objectKey: string;
    contentType: string;
    maxBytes: number;
    contentLength?: number;
  }): Promise<{ url: string; expiresAt: string }> {
    const tenantId = requireNonBlank(input.tenantId, "Tenant ID");
    const key = requireNonBlank(input.objectKey, "Storage object key");
    if (!key.startsWith(`${tenantId}/`)) {
      throw new Error("Storage object key must be tenant-scoped");
    }
    const contentType = requireNonBlank(input.contentType, "Content type");
    if (!isPositiveSafeInteger(input.maxBytes)) {
      throw new Error("Maximum upload size must be a positive safe integer");
    }
    if (
      input.contentLength !== undefined &&
      (!isNonNegativeSafeInteger(input.contentLength) ||
        input.contentLength > input.maxBytes)
    ) {
      throw new Error(
        "Content length must be a non-negative safe integer no greater than the maximum upload size",
      );
    }

    const now = this.now();
    const url = presignedUrl({
      endpoint: this.endpoint,
      bucket: this.bucket,
      objectKey: key,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      method: "PUT",
      expiresInSeconds: this.uploadExpiresInSeconds,
      contentType,
      now,
    });
    return {
      url,
      expiresAt: new Date(
        now.getTime() + this.uploadExpiresInSeconds * 1000,
      ).toISOString(),
    };
  }

  public async headObject(objectKey: string): Promise<StorageObjectMetadata> {
    const key = requireNonBlank(objectKey, "Storage object key");
    const response = await this.fetcher(
      presignedUrl({
        endpoint: this.endpoint,
        bucket: this.bucket,
        objectKey: key,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        method: "HEAD",
        expiresInSeconds: INTERNAL_REQUEST_EXPIRES_IN_SECONDS,
        now: this.now(),
      }),
      { method: "HEAD" },
    );
    if (!response.ok) {
      throw new Error(
        `Storage metadata request failed with status ${response.status}`,
      );
    }

    const contentLengthValue = response.headers.get("content-length");
    const contentLength =
      contentLengthValue === null ? null : Number(contentLengthValue);
    if (
      contentLength !== null &&
      (!Number.isSafeInteger(contentLength) || contentLength < 0)
    ) {
      throw new Error("Storage metadata response was invalid");
    }
    return {
      contentLength,
      contentType: response.headers.get("content-type"),
      etag: response.headers.get("etag")?.replace(/^"|"$/g, "") ?? null,
    };
  }

  public async readPrefix(
    input: Readonly<{
      tenantId: string;
      objectKey: string;
      maxBytes: number;
    }>,
  ): Promise<Uint8Array> {
    const tenantId = requireNonBlank(input.tenantId, "Tenant ID");
    const key = requireNonBlank(input.objectKey, "Storage object key");
    if (!key.startsWith(`${tenantId}/`)) {
      throw new Error("Storage object key must be tenant-scoped");
    }
    if (
      !isPositiveSafeInteger(input.maxBytes) ||
      input.maxBytes > MAX_OBJECT_PREFIX_BYTES
    ) {
      throw new Error(
        `Object prefix size must be a positive integer no greater than ${MAX_OBJECT_PREFIX_BYTES} bytes`,
      );
    }

    const response = await this.fetcher(
      presignedUrl({
        endpoint: this.endpoint,
        bucket: this.bucket,
        objectKey: key,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        method: "GET",
        expiresInSeconds: INTERNAL_REQUEST_EXPIRES_IN_SECONDS,
        now: this.now(),
      }),
      {
        method: "GET",
        headers: { range: `bytes=0-${input.maxBytes - 1}` },
      },
    );
    if (response.status !== 206) {
      throw new Error("Storage prefix request did not return partial content");
    }
    const contentRange = response.headers.get("content-range");
    const rangeMatch = /^bytes 0-(\d+)\/(?:\d+|\*)$/u.exec(contentRange ?? "");
    if (rangeMatch === null) {
      throw new Error("Storage prefix response range was invalid");
    }
    const rangeEnd = Number(rangeMatch[1]);
    if (!Number.isSafeInteger(rangeEnd) || rangeEnd + 1 > input.maxBytes) {
      throw new Error("Storage prefix response was too large");
    }

    const contentLengthValue = response.headers.get("content-length");
    if (contentLengthValue !== null) {
      const contentLength = Number(contentLengthValue);
      if (
        !isNonNegativeSafeInteger(contentLength) ||
        contentLength > input.maxBytes
      ) {
        throw new Error("Storage prefix response was too large");
      }
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > input.maxBytes) {
      throw new Error("Storage prefix response was too large");
    }
    return bytes;
  }

  public async createReadUrl(
    objectKey: string,
    expiresInSeconds = this.readExpiresInSeconds,
  ): Promise<string> {
    const key = requireNonBlank(objectKey, "Storage object key");
    const expiresIn = validateExpiration(
      expiresInSeconds,
      "Read URL expiration",
    );
    return presignedUrl({
      endpoint: this.endpoint,
      bucket: this.bucket,
      objectKey: key,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      method: "GET",
      expiresInSeconds: expiresIn,
      now: this.now(),
    });
  }

  public async delete(objectKey: string): Promise<void> {
    const key = requireNonBlank(objectKey, "Storage object key");
    const response = await this.fetcher(
      presignedUrl({
        endpoint: this.endpoint,
        bucket: this.bucket,
        objectKey: key,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        method: "DELETE",
        expiresInSeconds: INTERNAL_REQUEST_EXPIRES_IN_SECONDS,
        now: this.now(),
      }),
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(
        `Storage delete request failed with status ${response.status}`,
      );
    }
  }
}

export function createStoragePortFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StoragePort | null {
  const endpoint = env.STORAGE_ENDPOINT;
  const bucket = env.STORAGE_BUCKET;
  const accessKeyId = env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY;

  if (
    endpoint === undefined ||
    endpoint.trim().length === 0 ||
    bucket === undefined ||
    bucket.trim().length === 0 ||
    accessKeyId === undefined ||
    accessKeyId.trim().length === 0 ||
    secretAccessKey === undefined ||
    secretAccessKey.trim().length === 0
  ) {
    return null;
  }

  try {
    return new R2StorageAdapter({
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
    });
  } catch {
    return null;
  }
}
