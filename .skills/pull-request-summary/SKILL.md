---
name: pull-request-summary
description: Create an evidence-focused PR summary. Use for Wedding System tasks that match this workflow.
---

# Purpose

Create an evidence-focused PR summary.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Summarize scope.
2. List schema/API/security impact.
3. List tests/screenshots.
4. Explain rollout/rollback and approvals.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
