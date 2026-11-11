# CFI annotations (F26)

```ts
const selection = reader.interactions.captureSelection();
if (selection) {
  const annotation = reader.annotations.highlight(selection.cfi, {
    id: 'note-1',
    data: { note: 'Original note' },
    style: { color: '#ffcf00', opacity: 0.35 },
  });
  reader.annotations.update(annotation.id, { data: { note: 'Updated note' } });
  reader.annotations.remove(annotation.id);
}
```

Both reader implementations expose `annotations`. `highlight(rangeCfi, options?)` and `underline(rangeCfi, options?)` require a non-empty text range; `mark(cfi, options?)` also accepts point/element CFIs and places a badge at the range start. `add(type, cfi, options?)` is the explicit form. Targets must identify this publication's package/spine and reading body.

`get(id)`, `all()`, `update(id, patch)`, `remove(id)`, and `clear()` manage immutable registration snapshots. Updates retain ID/type and can replace CFI, data, label, interaction, or partial styles. Opaque `data` stays caller-owned and is neither cloned nor frozen. IDs can be supplied or generated; registrations survive chapter reload and continuous-view trimming for the reader lifetime. Durable storage belongs to the host; snapshots can be saved when their payloads are serializable.

Geometry lives in one host-owned SVG overlay outside the publication DOM. Rendering adds no body wrappers, changes no text, and preserves structural CFIs. Native Range rectangles account for scroll, fixed-page viewport fitting, RTL/vertical text, and host translation/scaling. Fragments are clipped and merged. Horizontal underlines use the rectangle's bottom edge; vertical underlines use its right edge. Offscreen marks disappear instead of pinning to viewport borders.

`style` accepts a host-context CSS `color`, `opacity` from 0–1, underline `thickness` from 0.5–12 CSS pixels, and mark `size` from 8–64 CSS pixels. Highlights default to 0.35 opacity; underlines and marks default to full opacity. IDs allow up to 128 characters and labels up to 256.

Highlights/underlines default to `interactive: false` so native selection and links remain available beneath them. Marks default to interactive. Set `interactive: true` and an accessible `label` to opt into painted-region input interception. `onClick()` receives the current registration and native host event. Interactive groups support mouse clicks, Enter, and Space; focus and payload updates preserve group identity. Host callbacks work with passive Chromium, Firefox, and WebKit frames without enabling book scripts.

`hide()` and `show()` control annotations independently of reader visibility. `element` exposes the owned SVG. Built-in navigation, layout, theme changes, host resize, and scrolling update geometry. Call `refresh()` after custom iframe scrolling/content changes when native callbacks are unavailable; `whenIdle()` awaits queued draws.

Rendered targets validate before add/update commits. Unloaded targets receive structural validation and resolve when displayed. Deferred invalid/oversized targets report through `onError()`, `lastError`, and `whenIdle()` while leaving book content and other annotations available. A successful refresh after removal/correction clears the error. Subscribers run synchronously and should not throw.

Limits are 4,096 registrations per reader, 20,000 native rectangles per target, 1,024 visible fragments per target, and 8,192 painted fragments per overlay. Reader/book destruction cancels callbacks, disconnects observers, removes SVG nodes, and releases registrations. Repeated cleanup is safe.
