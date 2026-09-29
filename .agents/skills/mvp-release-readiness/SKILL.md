---
name: mvp-release-readiness
description: Undangania MVP workflow for mvp release readiness.
disable-model-invocation: false
---

# Procedure
1. Verify scope.
2. Run repository/Prisma/npm gates.
3. Run purchase/publish/RSVP journeys.
4. Review security, UI/UX, observability and rollback.
5. Issue explicit decision.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
