# Task MVP-UI-010-GUEST-MANAGEMENT: Guest and Household Management

## 1. Objective and product value

Allow customers to organize invitees and personalized links without exposing sensitive contacts or forcing desktop tables onto mobile.

## 2. Primary actors

Wedding owner/editor managing households and guests.

## 3. User journey

```text
Open guests → search/filter → create/edit household → set event access/pax → copy/rotate/disable link → import/export
```

## 4. In scope

Open guests → search/filter → create/edit household → set event access/pax → copy/rotate/disable link → import/export

- Household and guest list.
- Search, tags, filters and status.
- Maximum pax and event access.
- Create/edit household.
- Personalized URL and share-message copy.
- Token rotation/disable.
- CSV upload, parse preview, invalid/duplicate review, confirm, result.
- Authorized export.

## 5. Out of scope

- Automated WhatsApp broadcast.
- Attendance/check-in.
- Contact enrichment.
- Silent duplicate merging.

## 6. Business and UX rules

- One opaque token per household in MVP.
- Plain token shown only at creation/rotation as required; hash stored.
- Duplicate detection is advisory and reviewed.
- Import requires preview and confirmation.
- Export is permission-controlled and audited.

## 7. Required UI states

No guests, loading, filtered empty, create/edit, invalid contact, duplicate candidate, import parsing, invalid rows, partial result, export processing, copied link, rotated/disabled token, permission denied, and service failure.

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

- Paginate or virtualize large lists when data warrants it.
- CSV parsing/import should not block the web request for large allowed files.
- Mobile uses list/detail or card-row pattern, not squeezed desktop table.

## 11. Security and privacy

- Encrypt contacts and use normalized hashes for duplicate signals.
- Tenant A/B and household token tests.
- Clipboard feedback does not expose link in telemetry.
- Export leaves audit evidence.
- Guest link is revocable.

## 12. Acceptance criteria

- [ ] CRUD, search, filter, event access, pax and token actions work.
- [ ] CSV preview distinguishes valid/invalid/duplicate before import.
- [ ] Mobile guest management is usable.
- [ ] No cross-tenant or cross-household access.
- [ ] Sensitive data is masked/minimized.
- [ ] UI and security gates pass.

## 13. Test plan and evidence

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Run `npm run test:e2e`, `npm run test:a11y`, and `npm run test:responsive` for user-facing changes.
- Use Next.js DevTools to inspect route, build, hydration, runtime, and log errors.
- Attach Playwright screenshots for required viewports and all exceptional states.
- Complete the consolidated UI quality release gate.

## 14. File boundaries

Allowed: guest routes/components, guest application/contracts, CSV import UI, tests.

Prohibited: automated messaging, check-in, direct plaintext token/contact persistence, unapproved export.

## 15. Required reviewers and approval

Guest Domain, UI/UX, Frontend, Backend, Database, Security/Tenancy, Accessibility, QA.

## 16. Claude Code execution prompt

```text
Use tenant-isolation-review, pii-telemetry-review, ui-ux-brief and implementation-plan. Design explicit mobile list/detail, import preview/confirmation, token rotation and export states. Implement after approval and test Tenant A/B, household A/B, invalid CSV, duplicates, permission, clipboard feedback, keyboard and all UI quality gates.
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
