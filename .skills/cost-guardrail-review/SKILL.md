---
name: cost-guardrail-review
description: Undangania MVP workflow for cost guardrail review.
---
# Procedure
1. Identify billable operations.
2. Set tenant/global caps.
3. Bound retry/output/storage derivatives.
4. Add metrics, alerts and kill switch.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
