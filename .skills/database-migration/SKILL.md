---
name: database-migration
description: Create safe Prisma/PostgreSQL migration. Use for Undangania tasks that match this workflow.
---

# Purpose

Create safe Prisma/PostgreSQL migration.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Inspect query and data impact.
2. Use expand/backfill/switch/contract.
3. Review constraints/indexes/locks.
4. Document forward recovery.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
