---
name: printing-order-flow
description: Implement printing vendor fulfillment. Use for Undangania tasks that match this workflow.
---

# Purpose

Implement printing vendor fulfillment.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Define quote/proof/vendor/production/shipping states.
2. Require proof approval.
3. Audit every transition.
4. Test rework/cancellation/delay.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
