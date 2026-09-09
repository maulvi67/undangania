---
name: documentation
description: Create or update authoritative documentation. Use for Wedding System tasks that match this workflow.
---

# Purpose

Create or update authoritative documentation.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Identify source of truth.
2. Describe decisions/contracts/operations.
3. Link requirements and code.
4. Run path consistency check.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
