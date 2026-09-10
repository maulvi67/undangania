# Task MVP-UI-002-LANDING-PAGE: Marketing Landing Page

## 1. Objective and product value

Help Indonesian couples understand the product quickly and move to the template catalog with confidence.

## 2. Primary actors

Prospective couple visiting on mobile or desktop.

## 3. User journey

```text
Discover product → understand value → see how it works → explore templates
```

## 4. In scope

Discover product → understand value → see how it works → explore templates

- Header/navigation.
- Editorial hero with primary CTA to catalog and secondary CTA to complete demo.
- Product value and how-it-works sections.
- Featured templates.
- Included core features and honest pricing explanation.
- Trust section without invented social proof.
- FAQ, final CTA, and footer.
- SEO metadata and social preview contract.

## 5. Out of scope

- Checkout implementation.
- Account/dashboard functionality.
- Fake user count, reviews, logos, ratings, awards, or countdown urgency.
- Heavy video background.

## 6. Business and UX rules

- Primary action is “Lihat koleksi desain”.
- Explain that core functions are available across templates.
- Price differences are explained through visual design/asset complexity.
- Activation/lifecycle language must be accurate.
- Copy is concise, warm, specific, and verifiable.

## 7. Required UI states

Initial loading if dynamic data is used, empty featured templates, catalog service unavailable, reduced motion, no-JavaScript navigation, and offline/retry if applicable.

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

- Majority Server Components/static rendering.
- Hero media is bounded and optimized.
- No unapproved third-party script.
- Metadata and content are available without hydration.
- Target good LCP, INP, and CLS.

## 11. Security and privacy

- No production secrets, customer PII, or real guest data.
- Validate external input server-side.
- Telemetry uses allowlisted, non-PII properties.
- Do not weaken authentication, tenant isolation, payment, or content-security controls.

## 12. Acceptance criteria

- [ ] Value proposition and CTA are understandable above the fold.
- [ ] Catalog and demo links are keyboard and touch accessible.
- [ ] No unverifiable marketing claim.
- [ ] SEO title, description, heading structure, canonical policy, and social preview are defined.
- [ ] Mobile and desktop compositions match approved design direction.
- [ ] UI quality release gate passes.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: marketing landing route, marketing components, metadata, approved assets and tests.

Prohibited: checkout logic, fabricated data, unlicensed media, global redesign outside approved tokens.

## 15. Required reviewers and approval

Product Manager, UI/UX, Frontend, Accessibility, SEO/Performance, Code Reviewer.

## 16. Claude Code execution prompt

```text
Use ui-ux-brief, impact-analysis, implementation-plan, ui-implementation, nextjs-runtime-diagnostics, accessibility-audit, responsive-layout-audit, ui-performance-audit, and ui-quality-gate.
Before coding, define information hierarchy, visual thesis, desktop/mobile composition, real Indonesian copy, SEO, states, performance risks, assets, exact files and tests. Wait for approval. Implement only the landing page and provide browser evidence.
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
