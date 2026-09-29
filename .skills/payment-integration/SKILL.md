---
name: payment-integration
description: Undangania MVP workflow for payment integration.
---
# Procedure
1. Implement adapter and verified webhook.
2. Perform atomic payment/order/entitlement/outbox update.
3. Handle duplicate/out-of-order/refund.
4. Add reconciliation.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
