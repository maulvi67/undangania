# Project Context

## Product

Undangania is a multi-tenant platform for Indonesian couples, wedding organizers, vendors, template designers, resellers, and platform administrators. The commercial entry point is a marketplace of digital invitation templates. Each wedding workspace manages events, website content, guests, RSVP, guestbook, gift information, media, orders, payment, subscriptions, printing, notifications, domains, and analytics.

## Core business decisions

- Tenant boundary is an organization/workspace; wedding is the primary customer resource.
- Digital Invitation Core is consistent across commercial template tiers; price reflects design complexity and licensing.
- Public invitation uses an immutable publication snapshot.
- Guest access uses high-entropy opaque tokens; only token hashes are stored.
- Money is stored as integer minor units and currency code.
- Timestamps are UTC; event timezone is explicit IANA name.
- Customer media lives in object storage, not PostgreSQL.
- AI does not auto-publish, auto-pay, auto-message, or invent factual wedding data.

## MVP boundary

Customer web, admin support, template marketplace/editor/renderer, core wedding/event/guest/RSVP/guestbook/gift/gallery/order/payment/package/notification/analytics. Vendor printing may launch as controlled integration. Subscription, automated WhatsApp, custom domains, reseller, vendor marketplace, advanced AI, and event-day tools can be feature-flagged enhancements.
