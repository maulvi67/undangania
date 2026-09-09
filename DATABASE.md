# Database

PostgreSQL shared-schema multi-tenancy. Every tenant row has `tenant_id`; wedding-bound rows also have `wedding_id`. IDs use UUID. Money uses `BIGINT` minor units. Timestamps use `TIMESTAMPTZ`. Public tokens are hashed. Sensitive contact/account data is encrypted or tokenized. JSON requires versioned schemas.

Migrations follow expand → backfill → switch → contract. No agent may run production migrations or destructive development commands without approval. See `packages/database/prisma/schema.prisma` and `docs/database/`.
