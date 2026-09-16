import { randomUUID } from "node:crypto";
import { createServer as createNodeServer } from "node:http";
import type {
  IncomingMessage,
  RequestListener,
  Server,
  ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  createRequestAuthContext,
  requireAnyRole,
  requireTenant,
  type MemberRole,
} from "@wedding/application";
import type {
  GuestHouseholdDto,
  GuestHouseholdRepository,
  SessionRepository,
  TenantMembershipRepository,
} from "@wedding/database";
import {
  MidtransNotificationPayloadError,
  MidtransNotificationSignatureError,
  processQrisNotification,
  QrisProcessingError,
  QrisNotificationValidationError,
  resolveMidtransServerKey,
  type QrisNotificationTransactionPort,
} from "@wedding/payments";
import { z } from "zod";

export const DEFAULT_PORT = 4000;
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

const SESSION_COOKIE_NAME = "ws_session";
const CORRELATION_HEADER = "x-correlation-id";
const ALLOWED_GUEST_ROLES = [
  "OWNER",
  "EDITOR",
  "VIEWER",
] as const satisfies readonly MemberRole[];
const RESOURCE_ID_SCHEMA = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);

type AuthRepositories = Readonly<{
  sessions: SessionRepository;
  memberships: TenantMembershipRepository;
  households: GuestHouseholdRepository;
}>;

export type BackendServerOptions = Readonly<{
  sessionRepository?: SessionRepository;
  membershipRepository?: TenantMembershipRepository;
  guestHouseholdRepository?: GuestHouseholdRepository;
  qrisTransaction?: QrisNotificationTransactionPort;
  /** Alias kept for callers that name the port after the transaction adapter. */
  qrisTransactionAdapter?: QrisNotificationTransactionPort;
  qrisNotificationProcessor?: typeof processQrisNotification;
  now?: () => Date;
  maxWebhookBodyBytes?: number;
}>;

export class DatabaseUnavailableError extends Error {
  public constructor() {
    super("Database is unavailable");
    this.name = "DatabaseUnavailableError";
  }
}

class HttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly allow: string | undefined = undefined,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

class BodyTooLargeError extends Error {
  public constructor() {
    super("Request body is too large");
    this.name = "BodyTooLargeError";
  }
}

class InvalidBodyLengthError extends Error {
  public constructor() {
    super("Invalid request body length");
    this.name = "InvalidBodyLengthError";
  }
}

const DEFAULT_MESSAGES = {
  badRequest: "The request could not be processed.",
  unauthorized: "Authentication is required.",
  forbidden: "You do not have permission to access this resource.",
  notFound: "The requested resource was not found.",
  methodNotAllowed: "The requested method is not allowed.",
  payloadTooLarge: "The request body is too large.",
  unavailable: "The service is temporarily unavailable.",
  internal: "The request could not be completed.",
  paymentVerification: "The payment notification could not be verified.",
} as const;

let databaseModulePromise: Promise<typeof import("@wedding/database")> | null =
  null;

function databaseModule(): Promise<typeof import("@wedding/database")> {
  databaseModulePromise ??= import("@wedding/database").catch(() => {
    throw new DatabaseUnavailableError();
  });
  return databaseModulePromise;
}

async function resolveAuthRepositories(
  options: BackendServerOptions,
): Promise<AuthRepositories> {
  if (
    options.sessionRepository !== undefined &&
    options.membershipRepository !== undefined &&
    options.guestHouseholdRepository !== undefined
  ) {
    return {
      sessions: options.sessionRepository,
      memberships: options.membershipRepository,
      households: options.guestHouseholdRepository,
    };
  }

  const database = await databaseModule();
  return {
    sessions:
      options.sessionRepository ?? new database.PrismaSessionRepository(),
    memberships:
      options.membershipRepository ??
      new database.PrismaTenantMembershipRepository(),
    households:
      options.guestHouseholdRepository ??
      new database.PrismaGuestHouseholdRepository(),
  };
}

function requestNow(options: BackendServerOptions): Date {
  return options.now?.() ?? new Date();
}

function correlationIdFromRequest(request: IncomingMessage): string {
  const header = request.headers[CORRELATION_HEADER];
  const candidate = Array.isArray(header) ? header[0] : header;
  if (candidate !== undefined && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)) {
    return candidate;
  }
  return randomUUID();
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  correlationId: string,
  allow?: string,
): void {
  if (response.headersSent) return;

  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader(CORRELATION_HEADER, correlationId);
  if (allow !== undefined) response.setHeader("allow", allow);
  response.end(JSON.stringify(body));
}

function sendError(
  response: ServerResponse,
  error: HttpError,
  correlationId: string,
): void {
  sendJson(
    response,
    error.status,
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    correlationId,
    error.allow,
  );
}

function methodNotAllowed(allow: string): HttpError {
  return new HttpError(
    405,
    "METHOD_NOT_ALLOWED",
    DEFAULT_MESSAGES.methodNotAllowed,
    allow,
  );
}

function isDatabaseUnavailableError(error: unknown): boolean {
  return (
    error instanceof DatabaseUnavailableError ||
    (error instanceof Error &&
      error.name === "DatabaseRepositoryUnavailableError")
  );
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof BodyTooLargeError) {
    return new HttpError(
      413,
      "PAYLOAD_TOO_LARGE",
      DEFAULT_MESSAGES.payloadTooLarge,
    );
  }
  if (error instanceof InvalidBodyLengthError) {
    return new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest);
  }
  if (isDatabaseUnavailableError(error)) {
    return new HttpError(
      503,
      "PROVIDER_UNAVAILABLE",
      DEFAULT_MESSAGES.unavailable,
    );
  }
  return new HttpError(500, "INTERNAL_ERROR", DEFAULT_MESSAGES.internal);
}

function parseDeclaredLength(request: IncomingMessage, maxBytes: number): void {
  const header = request.headers["content-length"];
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined) return;
  if (!/^\d+$/.test(value)) {
    throw new InvalidBodyLengthError();
  }

  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    throw new InvalidBodyLengthError();
  }
  if (length > maxBytes) {
    throw new BodyTooLargeError();
  }
}

/**
 * Reads bytes rather than characters so the limit cannot be bypassed with
 * multi-byte UTF-8 input. The raw string is passed unchanged to the payment
 * contract after decoding as UTF-8.
 */
export function readRawBody(
  request: IncomingMessage,
  maxBytes = MAX_WEBHOOK_BODY_BYTES,
): Promise<string> {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    request.resume();
    return Promise.reject(new InvalidBodyLengthError());
  }

  try {
    parseDeclaredLength(request, maxBytes);
  } catch (error) {
    request.resume();
    return Promise.reject(error);
  }

  return new Promise<string>((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    request.on("data", (chunk: Buffer | string) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > maxBytes) {
        settled = true;
        request.resume();
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(buffer);
    });

    request.on("end", () => {
      if (settled) return;
      settled = true;
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });

    request.on("aborted", () => {
      if (settled) return;
      settled = true;
      reject(new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest));
    });

    request.on("error", () => {
      if (settled) return;
      settled = true;
      reject(new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest));
    });
  });
}

function sessionTokenFromRequest(request: IncomingMessage): string | null {
  const header = request.headers.cookie;
  if (header === undefined) return null;

  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = pair.slice(separator + 1).trim();
    if (
      value.length === 0 ||
      value.length > 256 ||
      !/^[A-Za-z0-9._~-]+$/.test(value)
    ) {
      return null;
    }
    return value;
  }

  return null;
}

async function databaseCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new DatabaseUnavailableError();
  }
}

async function authorizeGuestRequest(
  request: IncomingMessage,
  options: BackendServerOptions,
): Promise<{ actorId: string; sessionId: string }> {
  const token = sessionTokenFromRequest(request);
  if (token === null) {
    throw new HttpError(401, "AUTH_REQUIRED", DEFAULT_MESSAGES.unauthorized);
  }

  const repositories = await resolveAuthRepositories(options);
  const now = requestNow(options);
  const session = await databaseCall(() =>
    repositories.sessions.findActiveByToken(token, now),
  );
  if (session === null) {
    throw new HttpError(401, "AUTH_REQUIRED", DEFAULT_MESSAGES.unauthorized);
  }

  return {
    actorId: session.userId,
    sessionId: session.id,
  };
}

function requiredWeddingId(url: URL): string {
  const values = url.searchParams.getAll("weddingId");
  if (values.length !== 1) {
    throw new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest);
  }

  const result = RESOURCE_ID_SCHEMA.safeParse(values[0]);
  if (!result.success) {
    throw new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest);
  }
  return result.data;
}

function householdIdFromPath(pathname: string): string {
  const prefix = "/v1/guest-households/";
  const encodedId = pathname.slice(prefix.length);
  if (encodedId.length === 0 || encodedId.includes("/")) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", DEFAULT_MESSAGES.notFound);
  }

  let householdId: string;
  try {
    householdId = decodeURIComponent(encodedId);
  } catch {
    throw new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest);
  }

  const result = RESOURCE_ID_SCHEMA.safeParse(householdId);
  if (!result.success) {
    throw new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest);
  }
  return result.data;
}

function safeGuestHouseholdDto(household: GuestHouseholdDto) {
  return {
    id: household.id,
    weddingId: household.weddingId,
    displayName: household.displayName,
    maximumPax: household.maximumPax,
    tokenVersion: household.tokenVersion,
    status: household.status,
    createdAt: household.createdAt.toISOString(),
    updatedAt: household.updatedAt.toISOString(),
  };
}

async function handleGuestHouseholds(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  correlationId: string,
  options: BackendServerOptions,
): Promise<void> {
  if (request.method !== "GET") {
    throw methodNotAllowed("GET");
  }

  const auth = await authorizeGuestRequest(request, options);
  const repositories = await resolveAuthRepositories(options);
  const weddingId = requiredWeddingId(url);
  const membership = await databaseCall(() =>
    repositories.memberships.resolveForUserAndWedding({
      userId: auth.actorId,
      weddingId,
    }),
  );
  if (membership === null) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", DEFAULT_MESSAGES.notFound);
  }
  const authContext = createRequestAuthContext({
    actorId: auth.actorId,
    sessionId: auth.sessionId,
    tenantId: membership.tenantId,
    roles: [membership.role],
  });
  try {
    const authorized = requireAnyRole(authContext, ALLOWED_GUEST_ROLES);
    requireTenant(authorized, membership.tenantId);
  } catch {
    throw new HttpError(403, "FORBIDDEN", DEFAULT_MESSAGES.forbidden);
  }
  const scope = { tenantId: membership.tenantId, weddingId };
  const pathname = url.pathname;

  if (pathname === "/v1/guest-households") {
    const households = await databaseCall(() =>
      repositories.households.list(scope),
    );
    sendJson(
      response,
      200,
      { data: households.map(safeGuestHouseholdDto) },
      correlationId,
    );
    return;
  }

  const householdId = householdIdFromPath(pathname);
  const household = await databaseCall(() =>
    repositories.households.findById(scope, householdId),
  );
  if (household === null) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", DEFAULT_MESSAGES.notFound);
  }

  sendJson(
    response,
    200,
    { data: safeGuestHouseholdDto(household) },
    correlationId,
  );
}

function webhookErrorToHttpError(error: unknown): HttpError {
  if (error instanceof MidtransNotificationPayloadError) {
    return new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest);
  }
  if (error instanceof MidtransNotificationSignatureError) {
    return new HttpError(
      401,
      "PAYMENT_VERIFICATION_FAILED",
      DEFAULT_MESSAGES.paymentVerification,
    );
  }
  if (error instanceof QrisNotificationValidationError) {
    return new HttpError(
      422,
      "PAYMENT_VERIFICATION_FAILED",
      DEFAULT_MESSAGES.paymentVerification,
    );
  }
  if (error instanceof QrisProcessingError) {
    return new HttpError(
      422,
      "PAYMENT_VERIFICATION_FAILED",
      DEFAULT_MESSAGES.paymentVerification,
    );
  }
  return toHttpError(error);
}

async function resolveQrisTransaction(
  options: BackendServerOptions,
): Promise<QrisNotificationTransactionPort> {
  const configured = options.qrisTransaction ?? options.qrisTransactionAdapter;
  if (configured !== undefined) return configured;

  const database = await databaseModule();
  return new database.PrismaQrisNotificationTransaction();
}

async function handleQrisWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  correlationId: string,
  options: BackendServerOptions,
): Promise<void> {
  if (request.method !== "POST") {
    throw methodNotAllowed("POST");
  }

  const rawBody = await readRawBody(
    request,
    options.maxWebhookBodyBytes ?? MAX_WEBHOOK_BODY_BYTES,
  );
  const serverKey = resolveMidtransServerKey(process.env);
  if (serverKey === null) {
    throw new HttpError(
      503,
      "PROVIDER_UNAVAILABLE",
      DEFAULT_MESSAGES.unavailable,
    );
  }

  const transaction = await resolveQrisTransaction(options);
  const processor =
    options.qrisNotificationProcessor ?? processQrisNotification;

  try {
    await processor(
      {
        rawBody,
        serverKey,
      },
      transaction,
    );
  } catch (error) {
    throw webhookErrorToHttpError(error);
  }

  sendJson(response, 200, { status: "acknowledged" }, correlationId);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: BackendServerOptions,
): Promise<void> {
  const correlationId = correlationIdFromRequest(request);

  let url: URL;
  try {
    url = new URL(request.url ?? "/", "http://localhost");
  } catch {
    sendError(
      response,
      new HttpError(400, "INVALID_INPUT", DEFAULT_MESSAGES.badRequest),
      correlationId,
    );
    return;
  }

  try {
    if (url.pathname === "/health") {
      if (request.method !== "GET") throw methodNotAllowed("GET");
      sendJson(response, 200, { status: "ok" }, correlationId);
      return;
    }

    if (url.pathname === "/v1/webhooks/midtrans-qris") {
      await handleQrisWebhook(request, response, correlationId, options);
      return;
    }

    if (
      url.pathname === "/v1/guest-households" ||
      url.pathname.startsWith("/v1/guest-households/")
    ) {
      await handleGuestHouseholds(
        request,
        response,
        url,
        correlationId,
        options,
      );
      return;
    }

    throw new HttpError(404, "RESOURCE_NOT_FOUND", DEFAULT_MESSAGES.notFound);
  } catch (error) {
    const httpError =
      url.pathname === "/v1/webhooks/midtrans-qris"
        ? webhookErrorToHttpError(error)
        : toHttpError(error);
    sendError(response, httpError, correlationId);
  }
}

export function createRequestHandler(
  options: BackendServerOptions = {},
): RequestListener {
  return (request, response) => {
    void handleRequest(request, response, options).catch((error: unknown) => {
      sendError(
        response,
        toHttpError(error),
        correlationIdFromRequest(request),
      );
    });
  };
}

export function createServer(options: BackendServerOptions = {}): Server {
  return createNodeServer(createRequestHandler(options));
}

export function startServer(
  port = parsePort(process.env.PORT),
  options: BackendServerOptions = {},
): Server {
  const server = createServer(options);
  server.listen(port);
  return server;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) return DEFAULT_PORT;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? port
    : DEFAULT_PORT;
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return (
    entrypoint !== undefined &&
    pathToFileURL(resolve(entrypoint)).href === import.meta.url
  );
}

if (isMainModule()) {
  startServer();
}
