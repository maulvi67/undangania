---
name: pii-telemetry-review
description: Wedding System MVP workflow for pii telemetry review.
disable-model-invocation: false
---

# Procedure
1. Inspect logs/traces/analytics/errors/jobs.
2. Find tokens/contacts/accounts/messages/raw payloads.
3. Use allowlisted pseudonymous attributes.
4. Add scrubbing tests.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
