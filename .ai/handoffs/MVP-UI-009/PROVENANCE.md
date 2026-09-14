# MVP-UI-009 Seruni provenance and asset decision

## Template

- ID: `seruni-klasik`
- Version: `1`
- Name: Seruni
- Category: Klasik
- Contract: Template Engine contract version `1`
- Status for this implementation: original in-repository golden theme

## Source origin

The Seruni public invitation renderer and its visual system were authored in-repository for MVP-UI-009. The implementation is not copied from a research-only template, screenshot, website, or external design source.

Human provenance approval was provided in the task conversation on 2026-09-11 before implementation began.

## Asset inventory

The golden renderer intentionally uses no external runtime assets:

| Asset type | Inventory | Origin/license |
| --- | --- | --- |
| Images | None. Gallery fixture tiles are CSS geometry only. | Not applicable |
| Audio/music | None. No audio is preloaded or autoplayed. | Not applicable |
| Video | None | Not applicable |
| Fonts | No bundled or remote fonts. Uses existing system font stacks from `@wedding/ui`. | System-provided fonts; no external font package or URL |
| SVG/icons | None in the golden renderer. Decorative marks are text/CSS. | Not applicable |
| Template source | Renderer, fixture, and CSS authored in this repository. | Original in-repo work |
| Third-party scripts | None | Not applicable |

Customer-owned publication media remains a future snapshot-pipeline concern and is not bundled into this golden fixture.

## Guardrails verified

- Renderer receives validated presentation data only.
- Renderer has no database, session, payment, guest-token, or provider SDK import.
- Map links are protocol allowlisted before rendering.
- Missing optional sections render no empty placeholder gap.
- Gallery tiles have reserved dimensions and no network requests.
- Music is user-initiated only if a validated snapshot URL exists; no preload/autoplay is used.
- The public fixture route is synthetic and marked `noindex`.
