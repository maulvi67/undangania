# Google OAuth for customer sign-in

## Configuration

Set these server-side values in the local secret store or deployment secret manager:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

Register the exact redirect URI with the Google OAuth client:

- Local development: `http://localhost:3000/api/auth/google/callback`
- Production: `https://<customer-web-host>/api/auth/google/callback`

Production callback URLs must use HTTPS. Never expose the client secret through a
`NEXT_PUBLIC_*` variable, browser bundle, log, or committed environment file.

## Authentication contract

The customer web app uses OAuth 2.0 authorization-code flow with PKCE (S256),
random state, and an OIDC nonce. State, nonce, verifier, and validated return path
use host-only, HttpOnly, SameSite=Lax cookies scoped to `/api/auth/google` with a
ten-minute lifetime. The callback checks state before exchanging the code.

The server exchanges the code only with Google's token endpoint. It accepts only
RS256 ID tokens with a valid Google signature, issuer, configured audience,
expiration, issued-at age, matching nonce, and `email_verified: true`. Google
access and refresh tokens are not persisted or returned to the browser.

After verification, the app creates the existing `ws_session` session and stores
only its token hash through `PrismaSessionRepository`. OAuth authentication does
not grant roles or replace tenant authorization. Accounts with privileged active
memberships are rejected by the customer OAuth flow so it cannot substitute for
an MFA ceremony.

New Google identities create a verified customer user, default tenant, OWNER
membership, wedding workspace, and `OAuthAccount` mapping in one transaction.
The mapping stores the provider subject, not Google tokens. A Google identity is
not automatically linked to an existing email/password account. Existing users
continue to sign in with their password; explicit account linking is not yet
implemented. Email collisions return the same generic OAuth failure as other
callback failures.

## Schema rollout and recovery

Migration `20260925120000_google_oauth_account` is additive and is not applied by
this change. Run Prisma generation and schema validation locally; do not apply
this migration to staging or production without database-owner approval and a
verified backup.

Disable Google OAuth by removing the Google server-side configuration. Prefer
leaving the additive table in place during application rollback. If the migration
must be rolled back, first disable Google sign-in, deploy code that no longer
reads `OAuthAccount`, and verify that no Google-created account depends on that
mapping. Dropping the table removes Google login bindings; it does not remove
users, workspaces, sessions, or password hashes. Users created through Google
have an unshared random password hash, so they must use password reset if Google
sign-in is disabled after rollback. Recover mappings from a verified backup if
rollback is required after Google users have been created.

## Privacy and operations

Do not log authorization codes, state, nonce, verifier, ID tokens, session tokens,
email addresses, or provider error details. Callback errors use generic UI copy.
Configure outbound HTTPS access to Google's authorization, token, and JWKS
endpoints in the app's egress policy.
