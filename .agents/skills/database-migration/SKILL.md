---
name: database-migration
description: Undangania MVP workflow for database migration.
disable-model-invocation: false
---

# Procedure
1. Assess data and lock risk.
2. Use expand/backfill/switch/contract.
3. Review constraints/indexes.
4. Document forward recovery.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
