# Task MVP-UI-001-DESIGN-SYSTEM: Design System and Product Shell

## 1. Objective and product value

Create the reusable visual, interaction, and accessibility foundation that keeps every MVP surface consistent without making the product look like a generic SaaS dashboard.

## 2. Primary actors

Couple/customer, guest, administrator, and support operator.

## 3. User journey

```text
Design direction → tokens → accessible primitives → application shell → showcase
```

## 4. In scope

Design direction → tokens → accessible primitives → application shell → showcase

- Semantic color, typography, spacing, radius, elevation, motion, and breakpoint tokens.
- Buttons, links, inputs, textarea, select, checkbox, radio, switch, tabs, dialog, drawer, menu, toast, alert, badge, progress, skeleton, empty state, and error state.
- Product header, sidebar, mobile navigation, content containers, and page title pattern.
- Design-system showcase route with real Indonesian labels and all states.

## 5. Out of scope

- Final landing page and product workflows.
- Final public invitation theme.
- Backend/provider integration.
- Copying a third-party design system without license.

## 6. Business and UX rules

- Visual character: warm, editorial, refined, calm, personal, contemporary Indonesian.
- Product UI and invitation themes remain visually distinct.
- Radius and cards are used intentionally, not universally.
- No fabricated statistics, testimonials, awards, or scarcity.
- Realistic Bahasa Indonesia replaces lorem ipsum.

## 7. Required UI states

Default, hover, active, focus, disabled, loading, selected, invalid, saved, saving, save failed, empty, success, warning, destructive, unauthorized, locked, and provider unavailable.

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

- Shared component code must be tree-shakeable.
- Avoid shipping showcase-only code to production screens.
- Fonts and icons are bounded and licensed.
- Motion uses compositor-friendly properties and reduced-motion alternatives.

## 11. Security and privacy

- No production secrets, customer PII, or real guest data.
- Validate external input server-side.
- Telemetry uses allowlisted, non-PII properties.
- Do not weaken authentication, tenant isolation, payment, or content-security controls.

## 12. Acceptance criteria

- [ ] Approved token definitions and design rationale exist.
- [ ] All foundational components render in the showcase.
- [ ] All critical component states are demonstrated.
- [ ] Keyboard/focus behavior and axe scan pass.
- [ ] Showcase works at required widths and 200% zoom.
- [ ] Components can be used without feature-specific styles leaking into them.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: shared UI package, design tokens, product shell, showcase route, UI tests and documentation.

Prohibited: business-domain implementation, payment/auth changes, final marketing page, arbitrary third-party component library addition.

## 15. Required reviewers and approval

UI/UX Agent, Frontend Agent, Accessibility review, SEO/Performance review, Code Reviewer.

## 16. Claude Code execution prompt

```text
Read the approved UI reference, UI/UX rules, all three UI quality checklists, and this task.
Use ui-ux-brief and implementation-plan before code. Present the complete visual system, component inventory, states, responsive behavior, accessibility requirements, performance considerations, and exact files. Wait for approval. Then implement only the design foundation and showcase, run all UI quality gates, and stop.
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
