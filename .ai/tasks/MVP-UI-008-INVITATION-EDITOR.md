# Task MVP-UI-008-INVITATION-EDITOR: Guided Invitation Editor

## 1. Objective and product value

Enable non-technical customers to configure a polished invitation safely through structured forms and live preview.

## 2. Primary actors

Wedding owner or editor.

## 3. User journey

```text
Open editor → update structured sections → autosave → preview → resolve publication issues
```

## 4. In scope

Open editor → update structured sections → autosave → preview → resolve publication issues

- Navigation for couple, events, venue, cover, story, gallery, music, gift, FAQ and settings.
- Structured fields, optional visibility, and limited ordering.
- Autosave with optimistic version.
- Desktop form plus preview.
- Mobile form-first plus explicit preview.
- Media processing states.
- Publication validation summary.

## 5. Out of scope

- Free-form drag-and-drop builder.
- Arbitrary customer CSS/JavaScript.
- Payment/provider implementation.
- Publishing from this task unless publication contract is already approved.

## 6. Business and UX rules

- Canonical InvitationViewModel is the editor contract.
- Autosave never hides failure.
- Stale-version conflict must not silently overwrite another edit.
- Preview receives validated draft DTO, not database models.
- Entitlement limits are enforced server-side.

## 7. Required UI states

Saved, saving, save failed, disconnected, stale version, invalid section, upload pending/processing/rejected/ready, missing publication data, quota reached, unauthorized, locked, and preview unavailable.

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

- Keep preview and form hydration bounded.
- Debounce saves without losing final input.
- Lazy-load gallery/media tooling.
- Do not ship all templates or admin code.
- Avoid re-rendering entire preview for trivial local changes when a safe narrower update exists.

## 11. Security and privacy

- Tenant/resource authorization on every read/save/upload.
- No raw HTML or arbitrary CSS/JS.
- Gift/contact values excluded from telemetry.
- Signed upload and validated media state.
- Stale version handled server-side.

## 12. Acceptance criteria

- [ ] Customer can edit all MVP sections.
- [ ] Save/refresh preserves data.
- [ ] Save failure and stale conflict are clear and recoverable.
- [ ] Desktop preview and mobile explicit preview are usable.
- [ ] Long content and missing optional sections work.
- [ ] No unauthorized tenant/template access.
- [ ] UI/performance/accessibility gates pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: editor routes/components, template-editor package, validated autosave/preview contracts, media UI states, tests.

Prohibited: arbitrary code injection, direct Prisma in UI, unapproved template renderer changes, payment logic.

## 15. Required reviewers and approval

Product, Wedding/Invitation Domain, Architect, UI/UX, Frontend, Backend, Template Agent, Security, Accessibility, Performance, QA.

## 16. Claude Code execution prompt

```text
Use publication-snapshot-review, ui-ux-brief, impact-analysis and implementation-plan. Before code, define information architecture, autosave state machine, stale resolution, preview communication, mobile strategy, fields, validation, upload states, performance boundaries and exact files. After approval implement and test edit, long/multi-event, errors, stale version, upload, refresh, keyboard, mobile and runtime evidence.
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
