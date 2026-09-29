---
name: develop-api
description: Design and implement a secure typed API. Use for Undangania tasks that match this workflow.
---

# Purpose

Design and implement a secure typed API.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Define auth/authorization.
2. Define Zod/OpenAPI/error/idempotency.
3. Implement thin controller and use case.
4. Add contract/integration tests.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
