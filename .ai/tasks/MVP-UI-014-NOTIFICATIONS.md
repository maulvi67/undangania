# Task MVP-UI-014-NOTIFICATIONS: Email and WhatsApp Development Notifications

## 1. Objective and product value

Provide reliable, consent-aware transactional notification UI and delivery feedback through development or sandbox adapters.

## 2. Primary actors

Customer, invited guest where permitted, support operator.

## 3. User journey

```text
Domain event → approved notification request → queue → provider adapter → delivery callback → status
```

## 4. In scope

Domain event → approved notification request → queue → provider adapter → delivery callback → status

- Email development delivery through console/local inbox.
- WhatsApp console/sandbox adapter.
- Notification preference and consent representation where relevant.
- Delivery status in appropriate customer/admin views.
- Retry, suppression, failure and support recovery states.
- Template code and variable validation.

## 5. Out of scope

- Production WhatsApp activation.
- Marketing campaigns.
- Bulk blast.
- Sending without consent or approved message category.

## 6. Business and UX rules

- Notification requests require idempotency key.
- Queue-based delivery with bounded retry.
- Opt-out/suppression honored.
- Message template variables are allowlisted.
- Delivery callback maps into canonical internal status.

## 7. Required UI states

Queued, sending, sent, delivered, failed retryable, failed permanent, suppressed, invalid recipient, provider unavailable, callback delayed, and duplicate request.

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

- Delivery runs asynchronously.
- UI does not poll aggressively.
- Provider SDK is not loaded in customer browser.
- Status lists paginate when needed.

## 11. Security and privacy

- Recipient and message body excluded from telemetry.
- Consent/category checked.
- Sandbox credentials only.
- Signed/verified callback when provider supports it.
- No production send without human approval.

## 12. Acceptance criteria

- [ ] Email can be inspected locally.
- [ ] WhatsApp sandbox/console request validates consent/template.
- [ ] Duplicate request does not duplicate delivery.
- [ ] Retry and suppression work.
- [ ] UI communicates status without exposing contact data.
- [ ] Security, cost, accessibility and QA gates pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: notification development adapters, queue contracts, status UI, sandbox callback tests.

Prohibited: production messaging, campaigns, bulk send, unrestricted recipient list, secret in source.

## 15. Required reviewers and approval

Notification/WhatsApp Agent, Security, Cost Review, Backend, Frontend, QA, human approval for production activation.

## 16. Claude Code execution prompt

```text
Use provider-contract-review, pii-telemetry-review, cost-guardrail-review and implementation-plan. Use console/local inbox and approved sandbox only. Define consent, category, idempotency, retries, suppression, callback and UI states. Test duplicate, timeout, callback delay, invalid recipient, suppression and PII-safe telemetry. Do not activate production sending.
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
