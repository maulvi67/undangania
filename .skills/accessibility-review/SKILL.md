---
name: accessibility-review
description: Review WCAG-oriented UI behavior. Use for Wedding System tasks that match this workflow.
---

# Purpose

Review WCAG-oriented UI behavior.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Inspect semantics.
2. Test keyboard/focus/labels/errors.
3. Check contrast/reduced motion.
4. Return reproducible findings.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
