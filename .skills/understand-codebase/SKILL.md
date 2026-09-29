---
name: understand-codebase
description: Map repository boundaries, ownership, contracts and relevant runtime paths before changing code. Use for Undangania tasks that match this workflow.
---

# Purpose

Map repository boundaries, ownership, contracts and relevant runtime paths before changing code.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Read root context.
2. Inspect CODEBASE_MAP and package manifests.
3. Locate owning domain and tests.
4. Return concise map and unknowns.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
