# Task MVP-UI-011-RSVP-GUESTBOOK: Guest RSVP and Guestbook

## 1. Objective and product value

Allow invited households to respond accurately in under sixty seconds and leave a safe optional message.

## 2. Primary actors

Guest household; owner/admin override is a separate authorized path.

## 3. User journey

```text
Open personalized invitation → review allowed events → submit/update RSVP → optional guestbook message
```

## 4. In scope

Open personalized invitation → review allowed events → submit/update RSVP → optional guestbook message

- Per-event attendance response.
- Pax selection within allowance.
- Existing-response update.
- Deadline and lock messaging.
- Confirmation and recovery.
- Guestbook input and moderation-pending feedback.
- Owner dashboard summary link where already available.

## 5. Out of scope

- QR check-in.
- Automated reminder campaign.
- Public display of unmoderated messages.
- Guest access to another household response.

## 6. Business and UX rules

- Response is per event.
- DECLINED implies pax 0; ATTENDING requires allowed pax.
- Server enforces deadline, lifecycle, event access and allowance.
- Submission is idempotent and concurrency-safe.
- Recoverable error preserves input.
- Guestbook is safely handled and moderated.

## 7. Required UI states

New, attending, declined, tentative, existing response, updating, success, recoverable failure, duplicate request, stale/concurrent update, locked, paused, expired, invalid token, rate limited, and guestbook pending/rejected.

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

- RSVP form is lightweight and avoids blocking provider scripts.
- Update response without unnecessary full-page hydration.
- Guestbook moderation/notification runs asynchronously.

## 11. Security and privacy

- Token-to-household-to-wedding scope verified.
- Rate limit token/IP hash.
- Idempotency key and transaction.
- Stored XSS and injection tests.
- No response/contact/message in analytics or shared cache.

## 12. Acceptance criteria

- [ ] Primary RSVP path completes in under sixty seconds.
- [ ] Per-event and pax rules are correct.
- [ ] Update and duplicate request are safe.
- [ ] Locked/paused/expired/invalid-token states are clear and secure.
- [ ] Input survives recoverable error.
- [ ] Guestbook cannot create stored XSS.
- [ ] Tenant, security and UI gates pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: public RSVP/guestbook UI, application/API contracts, tests and moderation-pending state.

Prohibited: check-in, unmoderated public rendering, raw token persistence/logging, auto-messaging.

## 15. Required reviewers and approval

Guest/RSVP/Guestbook Domain, Backend, Frontend, Security/Tenancy, Accessibility, Performance, QA.

## 16. Claude Code execution prompt

```text
Use tenant-isolation-review, api-development, test-feature, ui-ux-brief and implementation-plan. Define event/pax/deadline/idempotency/concurrency and every UI state before implementation. Test invalid token, unauthorized event, exceeding pax, duplicate, concurrent, locked, paused, expired, XSS, rate limit, keyboard, mobile and performance.
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
