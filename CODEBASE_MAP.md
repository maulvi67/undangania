# Codebase Map

- `apps/customer-web`: marketplace, customer dashboard, editor shell, public invitation routes.
- `apps/admin-dashboard`: support, finance, moderation, template/package administration.
- `apps/vendor-dashboard`: vendor profile, print orders, production and shipping updates.
- `apps/backend-api`: HTTP API, webhooks, signed uploads, provider callbacks.
- `services/background-worker`: outbox consumption, media, exports, reconciliation, lifecycle.
- `services/notification-service`: provider-neutral email and WhatsApp delivery.
- `packages/domain`: framework-independent business entities and policies.
- `packages/application`: use cases and ports.
- `packages/database`: Prisma schema, repositories, migrations, seeds.
- `packages/template-engine`: manifest, canonical view model, registry, rendering contracts.
- `packages/template-editor`: validated editor models and operations.
- `packages/ui`: shared accessible product UI.
- `packages/contracts`: Zod/API/event schemas.
- `packages/payments`, `notifications`, `storage`, `analytics`, `ai`: adapters and ports.
- `.agents`, `.skills`, `.ai`: agentic engineering operating system.
