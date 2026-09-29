---
name: nextjs-runtime-diagnostics
description: Undangania MVP workflow for nextjs runtime diagnostics.
disable-model-invocation: false
---

# Procedure
1. Detect version and running app.
2. Read bundled docs.
3. Collect errors/routes/logs.
4. Prove root cause and verify fix.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
