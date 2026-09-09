---
name: payment-gateway-integration
description: Integrate payment provider safely. Use for Wedding System tasks that match this workflow.
---

# Purpose

Integrate payment provider safely.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Use adapter.
2. Verify webhook signature/replay.
3. Implement idempotency/reconciliation.
4. Test duplicate/out-of-order/refund.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
