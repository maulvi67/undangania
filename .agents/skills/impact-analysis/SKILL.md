---
name: impact-analysis
description: Undangania MVP workflow for impact analysis.
disable-model-invocation: false
---

# Procedure
1. Trace modules, schema, API, events, cache, jobs and UI.
2. Identify compatibility/security/operations.
3. List reviewers.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
