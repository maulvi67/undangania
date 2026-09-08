---
name: api-development
description: Wedding System MVP workflow for api development.
---
# Procedure
1. Define auth, tenant authorization, Zod and errors.
2. Implement thin route and use case.
3. Add idempotency/audit/cache behavior.
4. Add contract/integration tests.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
