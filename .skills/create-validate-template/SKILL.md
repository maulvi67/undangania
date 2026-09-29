---
name: create-validate-template
description: Create or validate an original/licensed template. Use for Undangania tasks that match this workflow.
---

# Purpose

Create or validate an original/licensed template.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Verify origin/license.
2. Validate manifest and canonical model.
3. Test long/missing/multi-event/locales.
4. Run visual/accessibility/performance gates.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
