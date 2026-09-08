# Consolidated UI Quality Release Gate

A user-facing MVP feature can be approved only when:

- [ ] Accessibility checklist is complete with no blocker.
- [ ] Responsive checklist is complete with no blocker.
- [ ] Performance checklist is complete with no blocker.
- [ ] Chromium, Firefox, and WebKit critical path passes.
- [ ] Next.js runtime has no unexplained build, hydration, or runtime errors.
- [ ] Loading, empty, error, success, disabled, unauthorized, locked, and provider-failure states are tested where applicable.
- [ ] Tenant isolation and privacy checks pass.
- [ ] Screenshots, axe output, runtime logs, and performance evidence are attached.
- [ ] Any exception has severity, owner, due date, human approval, and rollback/kill-switch where relevant.

Decision: `BLOCK`, `CONDITIONAL APPROVAL`, or `APPROVE`.
