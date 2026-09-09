---
name: implementation-plan
description: Produce an approval-ready implementation plan. Use for Wedding System tasks that match this workflow.
---

# Purpose

Produce an approval-ready implementation plan.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Restate scope.
2. Break into atomic steps.
3. List files, migrations, tests, flags, rollback.
4. Mark human approvals.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
