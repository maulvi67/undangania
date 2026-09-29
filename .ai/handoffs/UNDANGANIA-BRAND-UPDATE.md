# Undangania Brand Update Handoff

Status: completed

## Objective

Replace the previous product brand with Undangania across customer
and admin interfaces, metadata, public invitation surfaces, shared UI, and
product context documentation.

## Decisions

- Canonical product name: `Undangania`.
- Updated the existing dashboard and admin monogram from `W` to `U`.
- No standalone logo, favicon, or app icon assets existed in the applications.
- Kept palette, typography, and other design tokens unchanged.
- Kept repository, workspace, package, import, and task identifiers unchanged
  (`wedding-system`, `@wedding/*`, and existing task IDs).
- Updated the TOTP issuer label to `Undangania` for new MFA enrolment URIs.
  Existing MFA secrets, sessions, and verification behavior are unchanged.

## Files and scope

- Customer-facing pages: titles, descriptions, Open Graph/site names, sign-in
  prompts, auth shell, marketing header/footer, editor, checkout, templates,
  guest management, RSVP, and public invitation branding.
- Admin-facing pages: metadata, error state, dashboard eyebrow, header mark and
  wordmark, and footer.
- Shared shell default brand and design-token component header labels.
- MFA issuer and related application/database test expectations.
- Product overview, system context, OpenAPI title, and active dashboard handoff.
- 83 project agent/skill markdown files, local setup example, and current design-plan branding.

## Architecture and impact

- Presentation and product metadata changes only.
- No route, API contract, database schema, migration, payment, tenant, or
  authorization behavior changed.
- MFA change only affects issuer text displayed by authenticator apps when a
  new enrollment URI is created. Existing authenticator entries retain their
  previous display label until re-enrollment.
- No migration or rollback procedure is required. Revert the brand-label changes
  to restore the previous display name.

## Validation

Passed:

- Typecheck: `@wedding/customer-web`, `@wedding/admin-dashboard`,
  `@wedding/application`, and `@wedding/database`.
- Tests: customer web 37 files / 256 tests; admin dashboard 4 files / 15 tests;
  application 6 files / 112 tests; database 32 files / 408 tests.
- Production builds: customer web and admin dashboard.
- Lint: all four workspaces completed with zero errors. Customer web reports two
  existing warnings in unrelated invitation image and editor test files.
- `git diff --check` completed without whitespace errors; Git emitted existing
  LF-to-CRLF working-copy warnings.
- Search found no previous brand in active product code or current product docs,
  agent instructions, and reusable project skills.
- Archived browser evidence keeps the prior accessible-name labels captured at test time.

Not run:

- Browser accessibility execution. `playwright.config.ts` limits discovery to
  `tests/e2e`; the public invitation accessibility spec is under
  `tests/accessibility` and was not discovered by that configuration.

## Follow-up

Technical repository, workspace, package, and task identifiers remain unchanged.
Archived browser evidence retains its original accessible-name output to preserve
the historical test record.
