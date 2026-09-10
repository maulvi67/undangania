# Task MVP-UI-009-PUBLIC-INVITATION: Golden Public Invitation

## 1. Objective and product value

Publish one original or commercially licensed invitation that is emotionally distinctive, fast, accessible, and reliable for guests on mobile devices.

## 2. Primary actors

Invited guest, including personalized household context.

## 3. User journey

```text
Open link → understand couple/event → navigate maps/gallery → RSVP → optional gift/guestbook
```

## 4. In scope

Open link → understand couple/event → navigate maps/gallery → RSVP → optional gift/guestbook

- Opening/hero, couple, events, countdown, maps, story, gallery, RSVP CTA, gift, guestbook, closing.
- Synthetic public fixture and personalized greeting boundary.
- Original approved visual direction.
- Publication snapshot renderer.
- Reduced-motion and no-JavaScript essential-reading behavior.

## 5. Out of scope

- Copied research template source.
- Renderer access to database/session/payment/raw token.
- Auto-playing media without user action.
- Heavy third-party animation/runtime.

## 6. Business and UX rules

- Source and every asset have approved origin/license.
- Common interactions use shared behavior.
- Guest context is limited and separate from shared cached publication.
- Missing optional sections leave no broken gap.
- All event times render in the intended timezone.

## 7. Required UI states

General public, personalized greeting, normal/long names, one/multiple events, missing optional, image failure, maps unavailable, RSVP available/locked, paused, expired, invalid guest token, reduced motion, and JavaScript unavailable.

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

- LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 target.
- Initial compressed JS and CSS follow repository budgets.
- Dynamic-load one template only.
- Responsive images, bounded fonts, lazy gallery, user-initiated audio.
- Public snapshot caching excludes private guest context.

## 11. Security and privacy

- Token hash lookup and wedding match.
- No guest PII in HTML cache, URL logs, analytics, or errors.
- Gift account content protected from telemetry.
- CSP and content sanitization.
- Paused/expired invitation blocks public mutations.

## 12. Acceptance criteria

- [ ] License/origin review passes.
- [ ] Canonical fixtures pass normal, long, multi-event, missing, id-ID and reduced motion.
- [ ] Public/private cache boundary is verified.
- [ ] Critical content remains readable without JavaScript.
- [ ] Browser, accessibility, responsive and performance gates pass.
- [ ] Paused, expired and invalid-token behavior is safe.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: one approved template package/theme, renderer route, public DTO integration, shared interactions, fixtures and tests.

Prohibited: copied source, unlicensed media/font/music, database/provider access from renderer, arbitrary scripts.

## 15. Required reviewers and approval

Template Agent, Template Quality Reviewer, Invitation Domain, Security/Tenancy, Accessibility, SEO/Performance, QA, human license approval.

## 16. Claude Code execution prompt

```text
Verify source and asset licenses first. Stop if unverified. Use template-create-validate, publication-snapshot-review, public-invitation-performance, accessibility-audit, responsive-layout-audit, ui-performance-audit and ui-quality-gate. Implement one golden template from canonical fixtures only. Prove cache/privacy boundaries and all lifecycle states.
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
