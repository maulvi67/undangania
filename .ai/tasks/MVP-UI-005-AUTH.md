# Task MVP-UI-005-AUTH: Authentication Experience

## 1. Objective and product value

Provide a low-friction and secure account entry experience without account enumeration or inaccessible authentication patterns.

## 2. Primary actors

New customer, returning customer, invited collaborator, and suspended user.

## 3. User journey

```text
Register/sign in → verify or recover → securely enter intended journey
```

## 4. In scope

Register/sign in → verify or recover → securely enter intended journey

- Sign in and registration.
- Email verification.
- Forgot/reset password.
- Expired/invalid link.
- Session expired.
- Suspended account.
- Safe post-auth redirect.
- Google OAuth login, approved by the user on 2026-09-25.

## 5. Out of scope

- Changing identity provider or session architecture without approval.
- Admin MFA implementation in this UI task.
- Other social providers and explicit account linking are not selected.

## Approved extension

The user approved Google OAuth in addition to the existing email/password
sign-in. The existing `ws_session` architecture remains unchanged. Google
identities are not automatically linked to existing email/password accounts;
admin MFA remains a separate requirement.

## 6. Business and UX rules

- No account existence disclosure.
- Paste and password-manager behavior remain enabled.
- Errors are actionable but safe.
- Redirect destination is validated.
- Authentication is not treated as resource authorization.

## 7. Required UI states

Idle, submitting, invalid credentials, verification required, email sent, invalid/expired token, rate limited, session expired, suspended, provider unavailable, and success redirect.

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

- Auth screen is lightweight and usable on constrained mobile connection.
- Provider script is loaded only if needed.
- Avoid unnecessary client-side validation duplication.

## 11. Security and privacy

- Security review and human approval are required for auth/session contract changes.
- CSRF/session/cookie handling stays server-owned.
- No email or auth error is sent to analytics.
- Return URL must be allowlisted.

## 12. Acceptance criteria

- [ ] Password manager, paste, keyboard, focus and error announcement work.
- [ ] Invalid and unknown accounts have safe response behavior.
- [ ] Expired session returns user to intended safe route where possible.
- [ ] Loading cannot cause duplicate submission.
- [ ] UI quality and security review pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed for the approved Google extension: auth UI, Google OAuth start/callback
routes, provider-token verification, the additive OAuth-account repository and
migration, and focused tests.

Prohibited: identity provider replacement, cookie policy changes, session
persistence changes, role grants, admin MFA changes, and production OAuth
credentials.

## 15. Required reviewers and approval

Identity owner, Security Agent, UI/UX, Frontend, Accessibility, QA, human approver for auth changes.

## 16. Claude Code execution prompt

```text
Read identity and security contracts. Use ui-ux-brief and implementation-plan. Define every authentication state, anti-enumeration behavior, password-manager/paste policy, redirect policy, accessibility and files. Wait for Security/human approval if auth behavior changes. Implement UI only within approved contract and run security plus UI quality gates.
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
