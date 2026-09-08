---
name: publication-snapshot-review
description: Wedding System MVP workflow for publication snapshot review.
---
# Procedure
1. Trace draft and publish.
2. Verify immutable version.
3. Verify explicit republish and cache invalidation.
4. Verify guest context exclusion.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
