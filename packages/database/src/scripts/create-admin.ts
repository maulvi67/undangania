import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../client";
import { PrismaUserAuthRepository } from "../repositories/user-auth";

/**
 * Provisions an admin account for the operations console (email + password).
 *
 * This is a local/development tool: it writes a real user, tenant, and ADMIN
 * membership to the configured database through the identity repository — no
 * fixtures, no seed data. It refuses to touch an email that already exists so a
 * typo cannot silently reset a password. Console access requires this ADMIN
 * membership; privileged mutations still require an MFA step-up at call time.
 *
 * Usage:
 *   npm run admin:create -w @wedding/database -- --email admin@undangania.id --password "rahasia-min-8" [--name "Nama Operator"]
 */

const ADMIN_TENANT_NAME = "Operasi Undangania";
const DEFAULT_OPERATOR_NAME = "Operator Undangania";
const MIN_PASSWORD_LENGTH = 8;
const MAX_EMAIL_LENGTH = 320;
const MAX_DISPLAY_NAME_LENGTH = 150;

type ParsedArgs = Readonly<{
  email: string;
  password: string;
  name: string;
}>;

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function usage(): string {
  return [
    "Penggunaan:",
    '  npm run admin:create -w @wedding/database -- --email admin@undangania.id --password "rahasia-min-8" [--name "Nama Operator"]',
  ].join("\n");
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined || !arg.startsWith("--")) continue;
    const body = arg.slice(2);
    const equals = body.indexOf("=");
    if (equals >= 0) {
      values.set(body.slice(0, equals), body.slice(equals + 1));
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      values.set(body, next);
      index += 1;
    } else {
      values.set(body, "");
    }
  }

  const email = (values.get("email") ?? "").trim().toLowerCase();
  const password = values.get("password") ?? "";
  const name = (values.get("name") ?? "").trim() || DEFAULT_OPERATOR_NAME;

  if (email === "" || password === "") {
    fail(`--email dan --password wajib diisi.\n\n${usage()}`);
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > MAX_EMAIL_LENGTH
  ) {
    fail("Format email belum valid.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  }
  if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    fail(`Nama maksimal ${MAX_DISPLAY_NAME_LENGTH} karakter.`);
  }

  return { email, password, name };
}

function loadDatabaseEnv(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
    ".env",
  );
  if (!existsSync(envPath)) {
    fail(
      "DATABASE_URL tidak diatur dan berkas .env tidak ditemukan. Isi DATABASE_URL terlebih dahulu.",
    );
  }
  process.loadEnvFile(envPath);
  if (!process.env.DATABASE_URL) {
    fail(`DATABASE_URL tidak ditemukan di ${envPath}.`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadDatabaseEnv();

  const users = new PrismaUserAuthRepository();
  try {
    const existing = await users.findByEmail(args.email);
    if (existing !== null) {
      fail(
        `Email ${args.email} sudah terdaftar (id: ${existing.id}). Akun tidak diubah.`,
      );
    }

    const created = await users.provisionAdmin({
      email: args.email,
      password: args.password,
      displayName: args.name,
      tenantName: ADMIN_TENANT_NAME,
    });

    console.log(
      [
        "",
        "✔ Akun admin dibuat.",
        `  Email    : ${created.user.email}`,
        `  Nama     : ${args.name}`,
        "  Peran    : ADMIN",
        `  Tenant   : ${created.tenantId} (${ADMIN_TENANT_NAME})`,
        "  Masuk di : http://localhost:3001/masuk",
        "",
      ].join("\n"),
    );
  } finally {
    // The repository shares the package client; release it so the CLI exits.
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("\n✖ Gagal membuat akun admin.");
  if (error instanceof Error && error.name === "UserAuthRegistrationError") {
    console.error("Email sudah terdaftar. Akun tidak diubah.");
  } else if (error instanceof Error && error.name === "UserAuthInputError") {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
