# MVP Implementation Guide

## Install and run

```bash
cp .env.example .env
docker compose up -d
npm install
npm run validate:repo
npm run dev
```

## Development sequence

1. Green foundation baseline.
2. Design system showcase and accessible primitives.
3. Landing and template catalog/detail.
4. Authentication and Wedding Workspace.
5. Canonical Template Engine and one original golden template.
6. Guided invitation editor and preview.
7. Versioned publication and public invitation.
8. Guest household, CSV, personalized token.
9. RSVP and guestbook.
10. Order, verified payment, entitlement and admin reconciliation.
11. Email and WhatsApp sandbox adapters.
12. Security, UX, accessibility, performance and release readiness.

## Every UI task

Run `ui-ux-brief`, approve one direction, implement with `ui-implementation`, diagnose with Next.js MCP, verify with Playwright, then run `ui-quality-gate`. Test 375, 390, 768 and 1440 widths; inspect keyboard, focus, errors, console and failed network requests.


## Dedicated UI quality gates

```bash
npm run test:a11y
npm run test:responsive
npm run test:ui-performance
```

Use the three specialized skills and complete all checklists under `docs/checklists/`. Automated accessibility testing is one layer; keyboard, zoom/reflow, screen-reader spot checks, and inclusive manual assessment remain required.
