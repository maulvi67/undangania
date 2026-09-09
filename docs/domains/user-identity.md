# Domain: User Identity

## Purpose
Identity and access.

## Actors
customer, collaborator, vendor user, reseller, admin.

## Entities
User, Account, Session, TenantMembership.

## Business rules
unique normalized email; MFA for privileged roles; revocable sessions.

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
credential/session protection, enumeration prevention.

## Owning module
`identity` owns the invariant and write model. Other modules integrate through application ports or versioned events.
