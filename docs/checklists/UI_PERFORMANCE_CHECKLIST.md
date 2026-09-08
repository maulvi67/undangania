# UI Performance QA Checklist

## Core metrics
- [ ] Public invitation lab LCP <= 2.5 seconds on agreed mobile profile.
- [ ] INP proxy/lab interactions <= 200 ms for opening, navigation, gallery, RSVP, and gift-copy.
- [ ] CLS <= 0.1.
- [ ] Field RUM plan records p75 after launch.

## Rendering and JavaScript
- [ ] Server Components used unless browser state/interactivity is required.
- [ ] No unnecessary hydration of static invitation sections.
- [ ] Initial public invitation compressed JavaScript stays within budget or has approved exception.
- [ ] Template implementation is dynamically loaded and does not bundle all themes.
- [ ] Heavy editor/admin code is not shipped to public invitation.
- [ ] No duplicate fetch or sequential waterfall without dependency.

## Images, fonts, and audio
- [ ] Hero uses responsive sizing and priority only when truly LCP-critical.
- [ ] Gallery images lazy-load below the fold.
- [ ] Width/height or aspect ratio is reserved.
- [ ] Upload pipeline limits dimensions and creates derivatives.
- [ ] Font families/weights are limited, subset, and use suitable display behavior.
- [ ] Audio is not preloaded before user action.

## Network and cache
- [ ] Public publication snapshot has documented cache and invalidation.
- [ ] Personalized guest context is excluded from shared public cache.
- [ ] Static assets have fingerprinted long-lived cache headers.
- [ ] Third-party requests are inventoried and justified.
- [ ] Provider failure does not block essential invitation content.

## Runtime
- [ ] No unbounded animation, interval, observer, or event-listener leak.
- [ ] Large lists use pagination/windowing where needed.
- [ ] Long tasks and layout thrashing reviewed.
- [ ] Console and network have no unexpected errors.
- [ ] Performance changes pass visual, accessibility, and functional regression.

## Evidence
- [ ] Trace or report attached.
- [ ] Before/after measurements recorded.
- [ ] Environment, network/CPU profile, route, fixture, and build SHA recorded.
- [ ] Approved exceptions have owner, expiration, and remediation plan.
