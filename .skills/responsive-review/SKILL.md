---
name: responsive-review
description: Validate responsive layout and interaction. Use for Wedding System tasks that match this workflow.
---

# Purpose

Validate responsive layout and interaction.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Test 375,390,768,1440 viewports.
2. Check overflow, long content, touch and safe areas.
3. Capture evidence.
4. Report severity.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
