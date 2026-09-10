# Task MVP-UI-006-ONBOARDING: Wedding Workspace Onboarding

## 1. Objective and product value

Allow a customer to reach a useful Invitation Editor state in under ten minutes with minimum required information.

## 2. Primary actors

Customer creating the first Wedding Workspace.

## 3. User journey

```text
Payment/account ready → identify couple → establish wedding/event basics → enter editor
```

## 4. In scope

Payment/account ready → identify couple → establish wedding/event basics → enter editor

- Couple names.
- Wedding date optional if undecided.
- Locale, timezone, and city.
- First event type/date/time.
- Venue and address with later-completion option.
- Progress, back, resume, save/continue, skip optional fields.
- Recovery from interrupted onboarding.

## 5. Out of scope

- Gallery, story, gifts, guests, vendor, printing, custom domain.
- Forcing all invitation data before editor access.

## 6. Business and UX rules

- Progressive disclosure and minimal required fields.
- Optional and required labels are explicit.
- Event date/time uses IANA timezone and clear local rendering.
- Back navigation does not lose valid input.
- Resume is deterministic.

## 7. Required UI states

New, saved, saving, validation error, date undecided, incomplete optional field, stale version, disconnected, save failed, resume, and completion.

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

- Steps do not require large client bundles.
- Avoid blocking geocoding/maps in minimum onboarding.
- Save operations are debounced/idempotent and visible.

## 11. Security and privacy

- Tenant is provisioned server-side.
- Customer cannot attach data to another tenant/wedding.
- Avoid collecting unnecessary personal information.
- Authorization is rechecked on each step.

## 12. Acceptance criteria

- [ ] Minimum path is completable in under ten minutes in usability test.
- [ ] Back/refresh/resume preserve saved data.
- [ ] Undecided date and optional venue are handled honestly.
- [ ] Timezone and event validation are correct.
- [ ] Mobile date/time and keyboard behavior are usable.
- [ ] UI, tenant, and security gates pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: onboarding routes/components, wedding/event use-case integration, validation schemas and tests.

Prohibited: full editor, guest/import, payment provider, speculative extra fields.

## 15. Required reviewers and approval

Product, Wedding Domain Analyst, UI/UX, Frontend, Backend, Security/Tenancy, Accessibility, QA.

## 16. Claude Code execution prompt

```text
Use validate-event-data, tenant-isolation-review, ui-ux-brief and implementation-plan. Present step structure, field specification, validation/messages, save/resume model, mobile behavior and exact files. Implement only after approval. Test interruption, back, refresh, date undecided, invalid timezone/event, Tenant A/B and all UI quality requirements.
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
