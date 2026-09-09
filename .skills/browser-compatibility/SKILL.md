---
name: browser-compatibility
description: Validate Chromium, Firefox and WebKit compatibility. Use for Wedding System tasks that match this workflow.
---

# Purpose

Validate Chromium, Firefox and WebKit compatibility.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Run deterministic Playwright coverage.
2. Inspect console/network.
3. Check progressive enhancement.
4. Record browser-specific defects.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
