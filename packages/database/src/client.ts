import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  __weddingPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.__weddingPrisma ?? new PrismaClient();

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__weddingPrisma = prisma;
}

export function getPrismaClient(): PrismaClient {
  return prisma;
}
