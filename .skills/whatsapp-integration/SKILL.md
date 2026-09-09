---
name: whatsapp-integration
description: Integrate approved WhatsApp messaging. Use for Wedding System tasks that match this workflow.
---

# Purpose

Integrate approved WhatsApp messaging.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Verify consent/category/templates.
2. Use queue and idempotency.
3. Handle callback/retry/suppression/cost.
4. Test provider failures.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
