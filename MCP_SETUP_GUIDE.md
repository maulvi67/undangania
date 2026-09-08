# MCP Setup

Shared `.mcp.json` includes only local development tools: Next.js DevTools and isolated Playwright Chromium. Context7 and GitHub are user-local because credentials or remote access may be involved. Add Sentry read-only only after staging exists. Do not add production database MCP to MVP.

Next.js DevTools provides routes, errors, logs and runtime metadata. Playwright validates actual UI and accessibility behavior. Context7 grounds third-party library/provider work in current documentation. GitHub remains read-oriented and may not merge, edit secrets, or bypass branch protection.
