---
name: tenant-isolation-review
description: Undangania MVP workflow for tenant isolation review.
disable-model-invocation: false
---

# Procedure
1. List affected tenant data.
2. Trace auth and ownership.
3. Inspect repository/cache scope.
4. Add Tenant A/B tests.
5. BLOCK on possible leakage.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
