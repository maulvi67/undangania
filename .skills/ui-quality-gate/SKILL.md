---
name: ui-quality-gate
description: Wedding System MVP workflow for ui quality gate.
---
# Procedure
1. Use Next DevTools for runtime errors.
2. Use Playwright across viewports.
3. Inspect console/network/keyboard/focus/states.
4. Return BLOCK, CONDITIONAL or APPROVE.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
