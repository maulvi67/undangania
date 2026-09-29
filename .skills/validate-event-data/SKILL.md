---
name: validate-event-data
description: Validate wedding dates, timezones, venues and event consistency. Use for Undangania tasks that match this workflow.
---

# Purpose

Validate wedding dates, timezones, venues and event consistency.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Normalize timezone.
2. Check chronological constraints.
3. Identify missing fields.
4. Return field errors without invention.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
