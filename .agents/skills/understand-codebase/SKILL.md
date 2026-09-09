---
name: understand-codebase
description: Wedding System MVP workflow for understand codebase.
disable-model-invocation: false
---

# Procedure
1. Map ownership and runtime paths.
2. Identify relevant contracts and tests.
3. Return unknowns without edits.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
