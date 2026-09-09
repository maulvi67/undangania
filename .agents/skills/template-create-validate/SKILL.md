---
name: template-create-validate
description: Wedding System MVP workflow for template create validate.
disable-model-invocation: false
---

# Procedure
1. Verify source/license.
2. Validate manifest and canonical model.
3. Test long/missing/multi-event/id-ID.
4. Run visual/a11y/performance QA.

## Required context
Read AGENTS, project context, active task, owning domain and relevant rules.

## Guardrails
Local/approved staging only; least privilege; no production credentials/deploy/destructive data; human approval for auth, payment, production migration/infrastructure, messaging activation and public AI output.

## Output
Task IDs, plan/findings, files, evidence, tests, risks, approvals and handoff.
