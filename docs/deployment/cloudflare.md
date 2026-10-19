# Cloudflare

Cloudflare fronts the application: DNS, TLS, CDN, WAF, and public caching. Media
is served straight from R2 through Cloudflare, so public bytes never transit
Railway.

## DNS and proxy

```text
example.com       -> Railway (proxied)
www.example.com   -> Railway (proxied, redirect to apex if preferred)
assets.example.com-> R2 custom domain (proxied)
```

The application origin is proxied so TLS termination, WAF, and caching apply.
`assets.example.com` is bound to the R2 bucket as a custom domain; it is the only
host that serves media.

## TLS

Cloudflare terminates TLS with Full (strict) toward the Railway origin. Origin
certificates are managed by Cloudflare/Railway, not committed to this repository.

## Media domain

R2 is exposed through the `assets.example.com` custom domain. The application
stores an **object key** (`weddings/{weddingId}/gallery/{uuid}.webp`) in the
database and signs short-lived read URLs at render time; it never stores or
exposes a permanent public URL or the bucket credentials.

## Cache policy

Cloudflare must never cache an authenticated or customer-specific response. Treat
these paths as private, bypassing cache and setting `Cache-Control: no-store` at
the origin:

```text
/api/auth/*
/api/admin/*
/api/customer/*
/api/payment/*
/api/webhooks/*
/admin/*
/dashboard/*
/tamu/*
/editor/*
/checkout/*
/pesanan/*
```

Safe to cache at the edge (public, unauthenticated):

```text
/w/*            public invitation pages by slug
/templates/*    public template previews
static assets   /_next/static/*, fonts, images with hashed names
```

Public invitation pages are served with a short TTL and invalidated at the origin
on publish: publishing deletes the `wedding:{slug}` cache key, and revalidation
bounds staleness. Media under `assets.example.com` is immutable once written
(object keys carry a UUID) and can be cached aggressively.

## Rate limiting

Apply Cloudflare rate limiting to authentication, payment, and analytics
endpoints as a first line of defence. Application-level limits remain
authoritative; see the analytics limiter note in `docs/deployment/environments.md`.

## What Cloudflare must not do

- Do not cache private API responses, admin routes, or dashboard pages.
- Do not route public media back through Railway when R2 delivery is available.
- Do not terminate TLS in a permissive mode that hides a broken origin.
