# Wedding System Agentic Codebase

Production-oriented starter monorepo for an Indonesian Wedding Management System. The repository combines customer, admin, and vendor applications with a backend API, workers, notification service, invitation template engine/editor, shared business packages, database schema, infrastructure, documentation, AI agents, reusable skills, and orchestrated workflows.

## Product surfaces

- Template marketplace and checkout
- Digital invitation editor and renderer
- Couple, wedding, event, guest, RSVP, guestbook, gift, and media management
- Orders, payment, subscriptions, packages, promotions, custom domains
- Customer, vendor, reseller, and administrator portals
- Printing order orchestration and shipping
- Email and WhatsApp notifications
- Analytics and moderation
- AI-assisted content, design, and recommendations with human approval

## Architecture

MVP uses a modular monolith and a single PostgreSQL database. Asynchronous work is handled by workers and an outbox. Provider integrations use ports/adapters. Modules can be extracted only when load, ownership, or SLOs justify the operational cost.

## Quick start

1. Copy `.env.example` to `.env` and use development-only credentials.
2. Run `docker compose up -d`.
3. Run `npm install`.
4. Run `npm run db:generate` then `npm run db:migrate:dev`.
5. Run `npm run dev`.
6. Before any change, read `AGENTS.md`, `PROJECT_CONTEXT.md`, and the relevant domain document.

## Safety

No agent may deploy production, alter authentication/payment/infrastructure contracts, run destructive database commands, or access production secrets without explicit human approval. Third-party copied wedding templates are excluded from production.

## Local setup and validation

See `LOCAL_SETUP_TESTING_GUIDE.md` for the complete local infrastructure, database, run, test, validation, agent, and troubleshooting workflow.
