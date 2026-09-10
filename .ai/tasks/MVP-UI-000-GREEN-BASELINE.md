# Task MVP-UI-000-GREEN-BASELINE: Green Baseline

## 1. Objective and product value

Establish a reproducible green baseline before product UI development so future failures can be attributed to the active task rather than the starter repository.

## 2. Primary actors

Developer, architect, QA, and orchestrator.

## 3. User journey

```text
Repository extraction → dependency installation → runtime diagnosis → verified baseline
```

## 4. In scope

Repository extraction → dependency installation → runtime diagnosis → verified baseline

- Validate package/workspace configuration.
- Validate MCP configuration and required agentic artifacts.
- Make TypeScript, test, and production build commands reproducible.
- Confirm local PostgreSQL and Redis development services.
- Confirm Next.js application starts and routes can be inspected.
- Record tool versions and unresolved foundation limitations.

## 5. Out of scope

- Product features.
- Final visual design.
- Authentication/payment/provider production integration.
- Production infrastructure or deployment.

## 6. Business and UX rules

- Fix root causes instead of suppressing errors.
- Do not use `any`, delete tests, or disable lint/type rules to obtain a green result.
- Dependency additions require purpose, license, maintenance, and bundle justification.
- npm is the only package manager.

## 7. Required UI states

- Application booting.
- Health/loading/error state for the starter application.
- Clear actionable output when required local infrastructure is unavailable.

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

- Inspect Next.js runtime errors and route boundaries.
- Avoid unnecessary Client Components, duplicate fetches, and broad imports.
- Reserve media dimensions and prevent layout shift.
- Record route transfer, request count, console/network failures, and Core Web Vitals where meaningful.

## 11. Security and privacy

- No production secrets, customer PII, or real guest data.
- Validate external input server-side.
- Telemetry uses allowlisted, non-PII properties.
- Do not weaken authentication, tenant isolation, payment, or content-security controls.

## 12. Acceptance criteria

- [ ] `npm run validate:repo` passes.
- [ ] Dependency tree has no blocking workspace error.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` pass, or each genuine starter limitation has an approved tracked task.
- [ ] Development server starts and Next.js DevTools returns route/error/log information.
- [ ] No unexplained console error or failed request on the starter routes.
- [ ] Baseline evidence and tool versions are recorded.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: root build configuration, package manifests, starter application, non-product test/configuration files, development documentation.

Prohibited: production credentials, production provider calls, destructive database commands, product feature implementation.

## 15. Required reviewers and approval

Orchestrator, Architect, QA, Code Reviewer. Human approval for dependency or architecture changes.

## 16. Claude Code execution prompt

```text
Read AGENTS.md, PROJECT_CONTEXT.md, CODEBASE_MAP.md, MVP_IMPLEMENTATION_GUIDE.md, MCP_SETUP_GUIDE.md, and this task.
Use understand-codebase, impact-analysis, mvp-bootstrap, implementation-plan, and nextjs-runtime-diagnostics.
Do not add product features. Inspect first, present root causes and exact file plan, then wait for approval. After approval, establish the smallest green baseline and report all commands and evidence.
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
