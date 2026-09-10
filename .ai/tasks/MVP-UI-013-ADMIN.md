# Task MVP-UI-013-ADMIN: Admin Operations Dashboard

## 1. Objective and product value

Give authorized operators a dense, auditable view of urgent payment, publication, job, template, and support problems without exposing unnecessary personal data.

## 2. Primary actors

Platform admin, support agent, finance operator, and moderator with distinct permissions.

## 3. User journey

```text
Authenticate with privileged role → identify operational issue → inspect masked context → take approved action → audit
```

## 4. In scope

Authenticate with privileged role → identify operational issue → inspect masked context → take approved action → audit

- Urgent payment reconciliation queue.
- Publication/worker failures.
- Template availability/review status.
- Support cases.
- Lifecycle exceptions.
- Printing order state when enabled.
- Audit trail access.
- Permission-aware action controls.

## 5. Out of scope

- Silent impersonation.
- Broad customer data browsing.
- Production infrastructure control.
- Destructive bulk action without separate approved task.

## 6. Business and UX rules

- Dense but readable, desktop-first with tablet fallback.
- Severity, age, owner and next action are explicit.
- Sensitive values masked by default.
- High-risk action requires reason, confirmation, step-up authentication where defined, and audit.
- Finance, support, moderator and platform admin capabilities differ.

## 7. Required UI states

Loading, empty healthy state, partial provider failure, stale data, permission denied, elevated access required, confirmation, reason required, mutation pending/success/failure, audit unavailable, and session expired.

## 8. Accessibility requirements

- Semantic landmarks and logical heading structure.
- Full keyboard operation with visible, unobscured focus.
- Accessible names for icon-only controls.
- Form labels, descriptions, required state, and field-associated errors.
- Status changes announced without stealing focus.
- Color is not the only indicator; reduced motion is respected.
- Automated axe scan plus manual keyboard, zoom/reflow, and screen-reader spot check.

## 9. Responsive requirements

- Test widths 320, 360, 375, 390, 412, 768, 1024, 1280, and 1440 where applicable.
- No document-level horizontal overflow.
- Test long Indonesian content, 200% zoom, mobile virtual keyboard, portrait and landscape.
- Sticky/fixed elements must not hide focused content or primary actions.

## 10. Performance requirements

- Server-side pagination/filtering.
- Avoid loading full audit/history or private content by default.
- Operational tables use bounded queries and stable sorting.
- Auto-refresh is controlled and does not disrupt focus.

## 11. Security and privacy

- MFA/step-up and role authorization.
- Masked diagnostics.
- Audit every privileged read/export/mutation as required.
- No secrets/raw payment payloads.
- Support access is time-bound and reasoned.

## 12. Acceptance criteria

- [ ] Role differences hide and reject unauthorized actions.
- [ ] Urgent queues have severity, age and ownership.
- [ ] High-risk action requires reason and confirmation.
- [ ] Auto-refresh does not break keyboard/focus.
- [ ] Sensitive data is masked and audit access is limited.
- [ ] Security, accessibility and operational UI gates pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: admin routes/components, authorized operation DTOs, audit presentation and tests.

Prohibited: infrastructure apply, secret management, unapproved impersonation, unrestricted customer export, raw provider payload.

## 15. Required reviewers and approval

Admin/Operations owner, Security, Finance/Payment, UI/UX, Frontend, Backend, Accessibility, QA, human approver for privileged actions.

## 16. Claude Code execution prompt

```text
Use ui-ux-brief and implementation-plan with the authorization matrix. Define role-to-view/action mapping, operational priorities, masking, confirmation/reason/step-up, pagination, partial failure and exact files. After approval implement only approved operations. Test every role, unauthorized server rejection, audit, keyboard tables/dialogs, refresh behavior and UI quality gates.
```

## 17. Definition of Ready

- [ ] Product objective, actor, scope, and acceptance criteria understood.
- [ ] Relevant design reference and domain contracts identified.
- [ ] Dependencies and open decisions documented.
- [ ] Exact file plan prepared.
- [ ] High-risk approval obtained when applicable.

## 18. Definition of Done

- [ ] Acceptance criteria and all required states implemented.
- [ ] Typecheck, unit tests, build, and relevant Playwright suites pass.
- [ ] Accessibility, responsive, and performance checklists completed.
- [ ] Console and network errors reviewed.
- [ ] Security/privacy and tenant boundaries verified.
- [ ] Screenshots, measurements, and test evidence stored in handoff.
- [ ] Documentation and task status updated.
- [ ] Reviewer decision is APPROVE or approved CONDITIONAL APPROVAL.
