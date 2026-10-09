# Domain: User Identity

## Purpose
Identity and access.

## Actors
customer, collaborator, vendor user, reseller, admin.

## Entities
User, Account, Session, TenantMembership, OAuthAccount.

## Business rules

- Email is unique after normalization; sessions are revocable.
- Privileged mutations require an MFA step-up; console access requires an authenticated session with an active privileged membership.
- Google OAuth accepts verified identities and never grants roles.
- New Google users receive the standard customer workspace and provider binding
  in one transaction.
- Existing password accounts are not silently linked by email. Explicit account
  linking is not implemented yet.

## Status and transitions
INVITED → ACTIVE → SUSPENDED → DELETED.

## Use cases
register, authenticate, invite member, change role, revoke session.

## Validation
email normalization, password/provider policy, role transition.

## Edge cases
duplicate email, last owner removal, suspended user.

## API
/auth, /users, /memberships.

## Domain events
UserRegistered, MemberInvited, RoleChanged, SessionRevoked.

## Dependencies
auth provider, audit.

## Security considerations

- Protect credentials and sessions; prevent account enumeration.
- Verify Google ID-token signature, issuer, audience, expiry, nonce, and verified
  email claim.
- Do not store provider tokens. Reuse the existing hashed-token session cookie.
- Reject privileged users from the customer Google flow until their separate MFA
  ceremony is complete.
- See `docs/security/google-oauth.md`.

## Owning module
`identity` owns the invariant and write model. Other modules integrate through application ports or versioned events.
