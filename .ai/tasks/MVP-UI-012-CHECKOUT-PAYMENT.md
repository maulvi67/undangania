# Task MVP-UI-012-CHECKOUT-PAYMENT: Checkout and Payment Status

## 1. Objective and product value

Enable an Indonesian customer to understand the exact purchase, pay through an approved gateway, and receive truthful confirmation only after server verification.

## 2. Primary actors

Customer purchaser; finance/support for safe reference information.

## 3. User journey

```text
Template selected → review order → choose payment → provider → verified status → workspace/entitlement
```

## 4. In scope

Template selected → review order → choose payment → provider → verified status → workspace/entitlement

- Selected template/package summary.
- Price, discount, tax if applicable, and total.
- Core features, fair usage and lifecycle explanation.
- Approved Indonesian payment methods.
- Pending, verifying, success, expired, failed, and delayed-confirmation screens.
- Safe order reference and support path.
- Retry/recheck behavior.

## 5. Out of scope

- Treating browser redirect as payment completion.
- Refund/admin reconciliation interface.
- Fake urgency or provider countdown not tied to real expiry.
- Production keys.

## 6. Business and UX rules

- Order/item/price snapshot is immutable.
- Provider-confirmed webhook/reconciliation is payment truth.
- UI cannot grant entitlement.
- Expiry shown only from actual transaction data.
- Duplicate checkout/submission is prevented or idempotent.

## 7. Required UI states

Order loading, coupon valid/invalid, payment creation, provider unavailable, pending, verifying, delayed, paid, failed, expired, amount mismatch safe error, already paid, duplicate action, offline, and support escalation.

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

- Payment SDK loaded only on checkout when required.
- Polling is bounded/backed off or replaced by safe refresh.
- Success page avoids large unnecessary client bundle.
- Provider failure does not lose order identity.

## 11. Security and privacy

- Payment and auth contract changes require Security and human approval.
- Signature/replay/amount/currency verification server-side.
- No raw payload or secret in browser/log/analytics.
- Order access is tenant/user authorized.
- Financial correction is audited.

## 12. Acceptance criteria

- [ ] Breakdown and lifecycle terms are understandable before payment.
- [ ] Pending cannot appear as paid.
- [ ] Verified paid state provisions entitlement exactly once.
- [ ] Failed/expired/delayed state has safe recovery.
- [ ] Duplicate action/event does not duplicate order/entitlement.
- [ ] Payment, security and UI gates pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: checkout and payment-status UI, approved payment adapter/use cases, sandbox contracts/tests.

Prohibited: production credentials, unapproved provider, client-authoritative payment status, refund/admin mutation.

## 15. Required reviewers and approval

Product, Order Agent, Payment Agent, Security, Database, Frontend, Accessibility, QA, human approval.

## 16. Claude Code execution prompt

```text
Use provider-contract-review and current official sandbox documentation, then impact-analysis, ui-ux-brief and implementation-plan. Present provider states, canonical mapping, callback/idempotency/reconciliation, UI states, security, exact files and tests. Wait for Payment/Security/human approval. Implement sandbox-only and prove duplicate/out-of-order/delayed/failed/expired/paid behavior.
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
