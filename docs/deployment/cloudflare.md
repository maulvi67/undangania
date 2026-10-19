# Cloudflare

Cloudflare fronts the application: DNS, TLS, CDN, WAF, and public caching. Media
is served straight from R2 through Cloudflare, so public bytes never transit
Railway.

## DNS and proxy

```text
example.com       -> Railway (proxied)
www.example.com   -> Railway (proxied, redirect to apex if preferred)
assets.example.com-> R2 custom domain (optional; not used by the current app)
```

The application origin is proxied so TLS termination, WAF, and caching apply.
Media delivery is described below: the bucket stays private and the app signs
short-lived read URLs, so a public media hostname is not part of the current
data model.

## TLS

Cloudflare terminates TLS with Full (strict) toward the Railway origin. Origin
certificates are managed by Cloudflare/Railway, not committed to this repository.

## Media domain

The R2 bucket stays private. The application stores an **object key**
(`{tenantId}/{weddingId}/media/{uuid}.{ext}`) in the database and signs a
short-lived read URL at render time (5 minutes by default). It never stores a
permanent public URL and never exposes bucket credentials.

`STORAGE_PUBLIC_URL` is not read by the application, so a public custom domain
is not required for media to work. Bind `assets.example.com` to R2 only for
assets that are intentionally public and immutable (for example template
artwork); do not point it at the wedding-media bucket, because signed URLs are
what keep unlisted media unlisted.

## R2 CORS

Uploads go from the browser straight to R2 after Railway signs a PUT, so the
bucket needs a CORS policy for the application origin:

```json
[
  {
    "AllowedOrigins": ["https://example.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`PUT` is the direct upload; `GET`/`HEAD` cover signed reads performed by browser
code. The presigned URL signs `content-type;host`, so the browser must send
exactly the `Content-Type` the server signed, which is why `Content-Type` is the
only allowed header. The signature travels in the query string, so no
`Authorization` header is involved. R2 answers the preflight itself, so `OPTIONS`
is not listed.

Add every origin the app is served from (apex, `www`, any preview host). A
missing origin surfaces as a CORS failure in the browser console, not as a
server error.

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
