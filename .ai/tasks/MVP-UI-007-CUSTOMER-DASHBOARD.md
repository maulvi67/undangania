# Task MVP-UI-007-CUSTOMER-DASHBOARD: Customer Wedding Dashboard

## 1. Objective and product value

Help the customer understand current wedding/invitation status and take the most useful next action without decorative dashboard clutter.

## 2. Primary actors

Wedding owner or editor.

## 3. User journey

```text
Open workspace → understand status → complete next action → access invitation/guest/RSVP/order
```

## 4. In scope

Open workspace → understand status → complete next action → access invitation/guest/RSVP/order

- Wedding countdown.
- Invitation lifecycle/status.
- Completion progress with explainable calculation.
- Prioritized next actions.
- Guest and RSVP summary.
- Quick navigation.
- Payment/entitlement/expiry warnings.
- Support entry point.

## 5. Out of scope

- Charts without decision value.
- Unverified statistics.
- Full analytics dashboard.
- Admin-specific controls.

## 6. Business and UX rules

- Next actions derive from real state and permissions.
- Status language distinguishes draft, ready, published, paused, expiring, expired, and payment pending.
- Editors do not see billing actions they cannot perform.
- Countdown uses wedding timezone/date semantics.

## 7. Required UI states

New workspace, draft, ready, published, paused, expiring, expired, payment pending, no guests, no RSVP, loading, partial failure, unauthorized, and provider unavailable.

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

- Aggregate queries are bounded/cached appropriately.
- Avoid multiple client fetch waterfalls.
- Dashboard charts are omitted unless decision value justifies cost.

## 11. Security and privacy

- Role-based actions and tenant scope required.
- Sensitive guest/contact/payment information is summarized or masked.
- Expired/paused access is represented server-side, not only visually.

## 12. Acceptance criteria

- [ ] Primary next action matches each lifecycle state.
- [ ] Permissions alter actions correctly.
- [ ] Partial service failure does not blank the whole dashboard.
- [ ] Summaries link to relevant detail screens.
- [ ] Mobile hierarchy remains clear.
- [ ] Tenant and UI quality gates pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: customer dashboard route/components, authorized aggregate DTOs, tests.

Prohibited: admin reconciliation, private contact lists on overview, invented metrics.

## 15. Required reviewers and approval

Product, Domain Analyst, UI/UX, Frontend, Backend, Security/Tenancy, QA.

## 16. Claude Code execution prompt

```text
Define state-to-primary-action mapping before code. Use ui-ux-brief, impact-analysis and implementation-plan. Implement a decision-oriented dashboard, not a card collection. Test every invitation/payment/expiry/empty/permission state, partial failures, mobile layout and tenant scope. Run all UI quality gates.
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
