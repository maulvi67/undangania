# Task MVP-UI-003-TEMPLATE-CATALOG: Template Marketplace Catalog

## 1. Objective and product value

Enable customers to compare and select a wedding invitation design in under three minutes without confusing design price with functional entitlement.

## 2. Primary actors

Prospective or authenticated customer.

## 3. User journey

```text
Open catalog → search/filter/sort → inspect card → open detail/demo
```

## 4. In scope

Open catalog → search/filter/sort → inspect card → open detail/demo

- Search by template name.
- Category and price-tier filters.
- Sort with explicit default.
- Responsive template grid.
- Clear design character, category, price, and demo/select actions.
- Mobile filter drawer.
- URL-reflected filters where appropriate.
- Loading, empty, no-result, and service-error states.

## 5. Out of scope

- Fake ratings, sales counts, scarcity, or “most popular” without evidence.
- Feature-badge overload.
- Production use of copied/unlicensed templates.
- Complex recommendation engine.

## 6. Business and UX rules

- All templates have the same Digital Invitation Core unless a documented entitlement says otherwise.
- Premium tiers refer to design/asset complexity, not better RSVP correctness.
- Filter state is understandable and reversible.
- Card interaction must not hide primary actions behind hover.

## 7. Required UI states

Loading/skeleton, empty catalog, no search result, filter applied, filter reset, service unavailable, image missing, inactive template, and signed-in/signed-out selection.

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

- Server-render initial catalog and query state.
- Optimized image ratios and dimensions.
- Search/filter does not trigger request storms.
- Avoid bundling full template renderers on catalog page.

## 11. Security and privacy

- No production secrets, customer PII, or real guest data.
- Validate external input server-side.
- Telemetry uses allowlisted, non-PII properties.
- Do not weaken authentication, tenant isolation, payment, or content-security controls.

## 12. Acceptance criteria

- [ ] Search, filter, sort, clear, detail, and select are usable by keyboard and touch.
- [ ] Filter state is shareable or intentionally local with documented rationale.
- [ ] No-result state suggests a useful recovery.
- [ ] Cards remain consistent with long names and missing images.
- [ ] Catalog does not leak unpublished templates.
- [ ] UI quality release gate passes.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: catalog route/components, catalog query contracts/mock data, tests and metadata.

Prohibited: editing/publishing templates, unapproved ranking logic, private template records, payment implementation.

## 15. Required reviewers and approval

Product, UI/UX, Frontend, Template Quality Reviewer, Accessibility, SEO/Performance, QA.

## 16. Claude Code execution prompt

```text
Design and implement the approved template catalog. Use ui-ux-brief first. Define customer decision model, card hierarchy, filters, mobile pattern, URL behavior, empty/error/loading states, keyboard behavior, image/performance strategy and files. After approval, implement and verify search, filters, reset, no-result, detail navigation, mobile drawer, browser matrix, accessibility and layout stability.
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
