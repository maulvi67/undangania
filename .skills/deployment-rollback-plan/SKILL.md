---
name: deployment-rollback-plan
description: Create deployment and rollback plan. Use for Undangania tasks that match this workflow.
---

# Purpose

Create deployment and rollback plan.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. List environments/dependencies.
2. Sequence migration/deploy/flags/smoke.
3. Define rollback triggers and owner.
4. Document data/provider recovery.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
