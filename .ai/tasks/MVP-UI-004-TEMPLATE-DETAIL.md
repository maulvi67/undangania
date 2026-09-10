# Task MVP-UI-004-TEMPLATE-DETAIL: Template Detail and Interactive Demo

## 1. Objective and product value

Answer all major design, price, feature, and lifecycle questions before a customer selects a template.

## 2. Primary actors

Customer comparing a specific template.

## 3. User journey

```text
Catalog → detail → device preview/full demo → select template
```

## 4. In scope

Catalog → detail → device preview/full demo → select template

- Approved template preview and gallery.
- Device preview switch or responsive demonstration.
- Design-character description.
- Supported sections/capabilities.
- Price and Digital Invitation Core explanation.
- Activation and lifecycle explanation.
- Select-template CTA and return-to-catalog.
- Mobile sticky action that never obscures focus/content.

## 5. Out of scope

- Fake reviews, sales counter, urgency, or unavailable assets.
- Loading the editor or all renderer implementations.
- Claiming unsupported capability.

## 6. Business and UX rules

- Manifest is source of truth for capability labels.
- Price is server-provided/configured.
- Demo content is synthetic and clearly illustrative.
- Template source/license must be approved before public use.

## 7. Required UI states

Loading, template unavailable/retired, preview media failure, demo unavailable, signed-out selection, payment package unavailable, and reduced motion.

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

- Preview assets use derivatives and dimensions.
- Full demo is lazy or separate route.
- Do not load all templates.
- Avoid iframe/accessibility traps unless justified and tested.

## 11. Security and privacy

- No production secrets, customer PII, or real guest data.
- Validate external input server-side.
- Telemetry uses allowlisted, non-PII properties.
- Do not weaken authentication, tenant isolation, payment, or content-security controls.

## 12. Acceptance criteria

- [ ] Customer can understand design, price, included features, and next step.
- [ ] Device/full preview works with keyboard and touch.
- [ ] Manifest and displayed capability stay consistent.
- [ ] Sticky CTA is accessible and unobtrusive.
- [ ] Retired/unavailable template has safe recovery.
- [ ] UI quality gate passes.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: template detail/demo routes, approved preview assets, typed manifest adapters and tests.

Prohibited: source conversion, unlicensed assets, payment truth, arbitrary remote scripts.

## 15. Required reviewers and approval

Product, Template Agent, Template Quality Reviewer, UI/UX, Accessibility, SEO/Performance, QA.

## 16. Claude Code execution prompt

```text
Use template-create-validate for source/license verification, then ui-ux-brief and implementation-plan. Present information hierarchy, demo strategy, mobile action, capability source, lifecycle copy, assets, performance and exact files. Stop if source/license is unverified. After approval, implement and run template plus UI quality gates.
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
