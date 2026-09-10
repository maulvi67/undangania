# Task MVP-UI-099-FINAL-QUALITY: Final Cross-Screen UI and UX Quality Review

## 1. Objective and product value

Independently verify that the complete MVP is coherent, accessible, responsive, fast, secure, and ready for controlled beta without adding features.

## 2. Primary actors

All MVP actors and independent reviewers.

## 3. User journey

```text
Review all MVP screens and critical journeys → consolidate defects → issue release decision
```

## 4. In scope

Review all MVP screens and critical journeys → consolidate defects → issue release decision

- Design system/showcase.
- Landing, catalog, detail, auth, onboarding, dashboard.
- Editor, public invitation, guest management, RSVP, guestbook.
- Checkout/payment, admin, notification states.
- Cross-screen navigation, copy, state, and component consistency.
- Critical purchase-to-publish and guest-to-RSVP journeys.

## 5. Out of scope

- New product feature.
- Visual redesign without approved remediation task.
- Increased performance budgets merely to pass.
- Suppression of violations.

## 6. Business and UX rules

- Review is independent and read-only.
- Findings are consolidated by root cause/severity.
- Exceptions require owner, due date, rationale and approval.
- Blockers cannot be downgraded without evidence.

## 7. Required UI states

Every state documented by prior tasks, including loading, empty, validation, error, success, disabled, unauthorized, locked, stale, offline, provider failure, paused, expired and rate limited.

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

- Measure representative production build, not development build alone.
- Evaluate public invitation and high-interaction editor separately.
- Include slow-network and reduced-CPU profiles.
- Verify field measurement plan for production.

## 11. Security and privacy

- Tenant isolation, payment truth, token handling, PII telemetry, admin permissions and public cache boundary are mandatory release gates.
- Review uses synthetic data and approved staging/local only.

## 12. Acceptance criteria

- [ ] Cross-screen visual and interaction consistency approved.
- [ ] All accessibility/responsive/performance checklists complete.
- [ ] Critical journeys pass Chromium, Firefox and WebKit.
- [ ] No unexplained console/network/runtime errors.
- [ ] Tenant/security/payment/privacy gates pass.
- [ ] Release decision and prioritized remediation exist.
- [ ] No critical/high unresolved blocker for beta.

## 13. Test plan and evidence

Run full npm gates plus all targeted UI, accessibility, responsive, performance, tenancy and provider tests. Capture screenshots, axe output, traces, performance reports, runtime logs and test results for each critical journey.

## 14. File boundaries

Read-only review of entire MVP. Reports may be written under `.ai/reports/` and task/handoff status updated.

Prohibited: source modification, feature addition, test/budget weakening, production deployment.

## 15. Required reviewers and approval

Orchestrator, independent QA, Security, Accessibility, SEO/Performance, Template Quality, Code Reviewer, Product Owner for final decision.

## 16. Claude Code execution prompt

```text
Do not modify source. Read all completed MVP-UI tasks, handoffs, approved visual reference and checklists. Use nextjs-runtime-diagnostics, accessibility-audit, responsive-layout-audit, ui-performance-audit, ui-quality-gate, tenant-isolation-review, pii-telemetry-review and mvp-release-readiness. Test all critical screens, browsers, widths, zoom, keyboard, reduced motion, long/missing content, provider failures and slow network. Return executive summary, findings by severity, cross-screen issues, remediation plan, and BLOCK, CONDITIONAL APPROVAL or APPROVE.
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
