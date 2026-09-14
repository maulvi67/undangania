# Design Plan — MVP-UI-008 Guided Invitation Editor

Status: APPROVED and IMPLEMENTED

## 1. Product job and boundary

The editor helps a wedding owner or authorized editor configure an Indonesian
wedding invitation through guided forms, not a drag-and-drop page builder.

Journey:

```text
Open editor → update structured sections → autosave → preview → resolve publication issues
```

The editor owns mutable draft editing and preview. It does not publish, process
payments, or mutate immutable publication snapshots.

## 2. Information architecture

Desktop uses a three-column workspace:

1. Persistent section navigation:
   - Mempelai
   - Acara
   - Lokasi & peta
   - Sampul
   - Kisah
   - Galeri
   - Musik
   - Hadiah
   - FAQ
   - Tampilan bagian
   - Urutan bagian
   - Pengaturan undangan
2. Form area for the selected section.
3. Sticky live preview with phone/desktop switch.

Mobile is form-first. The section list becomes a native select and the preview
is opened explicitly through a dialog. The sticky preview action reserves scroll
space and is not shown on desktop.

## 3. Canonical model and validation

The renderer-facing `InvitationViewModel` is the only preview boundary. Editor
state is structured and validated with Zod; it contains no customer HTML, CSS,
or JavaScript.

Publication readiness is manifest-aware and reports:

- both couple names;
- at least one valid event and venue;
- valid map URL when provided;
- valid invitation slug;
- visible required sections;
- rejected image media.

Incomplete drafts remain editable and previewable. Incomplete event rows are
omitted from the renderer model rather than causing preview failure, while the
publication readiness panel points the customer back to the event form.

## 4. Autosave state machine

The UI exposes these states without hiding failures:

- loading
- saved
- dirty
- saving
- save failed
- offline/disconnected
- stale version
- invalid section
- upload processing/rejected
- provider unavailable
- entitlement limit reached
- locked
- unauthorized

Changes are debounced for 650ms. The latest pending document remains in a ref
while a save is in flight. Local recovery is best effort only and is never
presented as authoritative persistence.

## 5. Stale-version resolution

The last acknowledged document is the merge base. A stale save performs a
section-level three-way merge:

- non-overlapping local changes are retained;
- server-only changes are retained;
- simultaneous changes are shown in an explicit conflict panel;
- the customer chooses “Pertahankan versi saya” or “Gunakan versi terbaru”;
- “Gunakan versi terbaru untuk semua” discards local conflict changes.

The editor never silently overwrites a newer server version.

## 6. Preview communication

The current editor uses an in-process validated DTO preview for the MVP. The
preview is labelled as a private draft and sample values are not presented as a
published invitation. The typed preview protocol remains available for a future
same-origin iframe boundary; all messages are schema-validated and same-origin
checks are defined in `preview-contract.ts`.

## 7. Section field strategy

- Couple: structured names and optional introduction.
- Events: repeatable event rows with native date/time input, timezone, title,
  and explicit removal.
- Venue: venue, address, and optional HTTP(S) map URL per event.
- Cover: native image selection, MIME/size preflight, alt text, and explicit
  processing/rejection/ready status.
- Story: visibility, title, and body.
- Gallery: uses uploaded image assets and requires alt text.
- Music: allowlisted URL field, no autoplay, no provider integration.
- Gift: repeatable structured provider/account fields with explicit visibility.
- FAQ: repeatable question/answer fields with explicit visibility.
- Visibility: labelled checkboxes; hidden content remains in the draft.
- Order: only manifest-approved sections can move, with `Naik`/`Turun`
  controls; no drag-only interaction.
- Settings: allowlisted locale, Indonesian timezone options, slug, and theme
  tokens.

## 8. Required UI states

Route-level states:

- loading skeleton;
- unauthorized/forbidden with sign-in and account links;
- provider unavailable with retry guidance;
- route error boundary.

Editor states:

- saved/saving/dirty status;
- save failure and offline alerts;
- stale conflict resolution;
- invalid publication issues;
- entitlement/provider warnings;
- upload processing and rejected media;
- mobile and desktop preview modes;
- local draft recovery prompt.

## 9. Accessibility and responsive requirements

- semantic header, main, nav, section, fieldset, legend, and heading structure;
- native labelled inputs with required state, hints, and errors;
- status changes announced through live regions without focus theft;
- keyboard-operable navigation, radio device switch, buttons, dialog, and order
  controls;
- visible focus from the shared design system;
- status is not communicated by color alone;
- reduced-motion CSS removes transitions and animation;
- mobile preview action is sticky but does not obscure focused content;
- mobile form-first layout and 200% reflow-friendly wrapping;
- long Indonesian labels and values use overflow-safe wrapping.

## 10. Performance boundaries

- Server route loads the initial fixture result once.
- Client hydration is limited to the editor workspace.
- Preview renders the validated model locally; no cross-origin iframe or network
  preview request is introduced in this MVP.
- Autosave is debounced and does not lose the latest queued edit.
- Media processing is represented by a bounded local simulation; real uploads
  must be signed and provider-backed.
- No template catalog or admin code is bundled into an editor-specific API.

## 11. Exact files

### Contracts and transport

- `packages/template-engine/src/index.ts`
- `packages/template-engine/src/index.test.ts`
- `packages/template-editor/src/index.ts`
- `packages/template-editor/src/index.test.ts`
- `apps/customer-web/package.json`
- `apps/customer-web/src/lib/editor/contract.ts`
- `apps/customer-web/src/lib/editor/contract.test.ts`
- `apps/customer-web/src/lib/editor/autosave-state.ts`
- `apps/customer-web/src/lib/editor/autosave-state.test.ts`
- `apps/customer-web/src/lib/editor/stale-merge.ts`
- `apps/customer-web/src/lib/editor/stale-merge.test.ts`
- `apps/customer-web/src/lib/editor/preview-contract.ts`
- `apps/customer-web/src/lib/editor/preview-contract.test.ts`
- `apps/customer-web/src/lib/editor/media-contract.ts`
- `apps/customer-web/src/lib/editor/media-contract.test.ts`
- `apps/customer-web/src/lib/editor/draft-store.ts`
- `apps/customer-web/src/lib/editor/draft-store.test.ts`
- `apps/customer-web/src/lib/editor/stub-transport.ts`

### Route and styling

- `apps/customer-web/src/app/editor/page.tsx`
- `apps/customer-web/src/app/editor/loading.tsx`
- `apps/customer-web/src/app/editor/error.tsx`
- `apps/customer-web/src/app/editor.css`

### Editor shell and preview

- `apps/customer-web/src/components/editor/editor-shell.tsx`
- `apps/customer-web/src/components/editor/editor-header.tsx`
- `apps/customer-web/src/components/editor/section-navigation.tsx`
- `apps/customer-web/src/components/editor/editor-form.tsx`
- `apps/customer-web/src/components/editor/editor-section-status.tsx`
- `apps/customer-web/src/components/editor/save-status.tsx`
- `apps/customer-web/src/components/editor/publication-readiness.tsx`
- `apps/customer-web/src/components/editor/editor-preview.tsx`
- `apps/customer-web/src/components/editor/mobile-preview-dialog.tsx`
- `apps/customer-web/src/components/editor/device-preview.tsx`
- `apps/customer-web/src/components/editor/stale-version-panel.tsx`
- `apps/customer-web/src/components/editor/provider-state.tsx`
- `apps/customer-web/src/components/editor/upload-state.tsx`

### Guided section forms

- `apps/customer-web/src/components/editor/sections/section-couple.tsx`
- `apps/customer-web/src/components/editor/sections/section-events.tsx`
- `apps/customer-web/src/components/editor/sections/section-venue.tsx`
- `apps/customer-web/src/components/editor/sections/section-cover.tsx`
- `apps/customer-web/src/components/editor/sections/section-story.tsx`
- `apps/customer-web/src/components/editor/sections/section-gallery.tsx`
- `apps/customer-web/src/components/editor/sections/section-music.tsx`
- `apps/customer-web/src/components/editor/sections/section-gift.tsx`
- `apps/customer-web/src/components/editor/sections/section-faq.tsx`
- `apps/customer-web/src/components/editor/sections/section-visibility.tsx`
- `apps/customer-web/src/components/editor/sections/section-order.tsx`
- `apps/customer-web/src/components/editor/sections/section-settings.tsx`

## 12. Test plan

Development validation:

- strict typecheck for template-engine, template-editor, and customer-web;
- unit tests for canonical contracts, readiness, autosave, stale merge, preview
  messages, media transitions, and draft recovery;
- scoped ESLint for editor route/components/contracts;
- Prettier check;
- customer-web production build;
- `git diff --check`.

Browser-level accessibility, responsive, performance, screenshot, console, and
network gates remain deferred under the current user direction to focus on code
development and not add/run Playwright suites during this pass.
