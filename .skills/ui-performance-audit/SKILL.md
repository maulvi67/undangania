---
name: ui-performance-audit
description: Audit public invitation and product UI performance using runtime evidence, performance budgets, bundle review, network traces, and Core Web Vitals.
---
# Budgets
Public invitation p75 target: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1. Lab budgets: mobile JS initial <= 170 KB compressed for public invitation, CSS <= 70 KB compressed, no unapproved third-party scripts, hero media appropriately sized, and no audio preload before user intent.

# Procedure
1. Use Next.js DevTools to inspect routes, runtime errors, logs, rendering boundaries, and route metadata.
2. Record cold/warm navigation, request count, transfer size, main-thread long tasks, hydration work, image/font loading, and cache behavior.
3. Identify unnecessary Client Components, waterfalls, duplicate requests, broad imports, unbounded lists, layout thrashing, oversized assets, and third-party code.
4. Validate responsive images, explicit media dimensions, font subset/weights, lazy gallery, dynamic template import, user-initiated audio, and snapshot caching.
5. Measure LCP, INP, and CLS in lab; configure field RUM before production. Lab success is not a substitute for field p75.
6. Re-run visual, interaction, and accessibility tests after optimization to prevent quality regression.

# Release gate
BLOCK public invitation when LCP/INP/CLS target is materially missed without approved exception, initial bundle exceeds budget without evidence, layout shift changes interaction, media is unbounded, or a third-party script blocks critical content.
