---
name: impact-analysis
description: Assess direct, indirect, data, API, event, security, operational and migration impact. Use for Undangania tasks that match this workflow.
---

# Purpose

Assess direct, indirect, data, API, event, security, operational and migration impact.

## Preconditions

Read `AGENTS.md`, active task, codebase map, owning domain, and relevant security/testing contracts. Stop if scope, ownership, source license, or approval is missing.

## Procedure

1. Map requirement to modules.
2. Trace consumers and events.
3. Identify compatibility and rollout risk.
4. Return impacted files and reviewers.

## Guardrails

Least privilege; no production secrets or deployment; no destructive database action; no fabricated business data; no copied third-party template promotion; request human approval for high-risk changes.

## Output

Task/requirement IDs, context read, plan or findings, files, evidence, tests, risks, approvals, follow-up, and handoff target.
