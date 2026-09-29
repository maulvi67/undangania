---
name: provider-contract-review
description: Undangania MVP workflow for provider contract review.
disable-model-invocation: false
---

# Procedure
1. Retrieve current docs.
2. Map provider states/auth/callbacks.
3. Define timeout/retry/idempotency/reconciliation.
4. Add sandbox contract tests.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
