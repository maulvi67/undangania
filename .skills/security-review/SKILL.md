---
name: security-review
description: Perform evidence-based security and privacy review. Use for Wedding System tasks that match this workflow.
---

# Purpose

Perform evidence-based security and privacy review.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Map trust boundaries.
2. Review tenant/auth/input/token/provider/data/telemetry.
3. Run approved scans/tests.
4. Return severity and release decision.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
