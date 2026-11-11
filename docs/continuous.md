# Continuous reading (F22)

```ts
const book = await Book.open('/books/original.epub');
const reader = book.renderContinuous('#reader', {
  preloadBefore: 1,
  preloadAfter: 1,
  maxViews: 32,
});
reader.onError((error) => console.error(error));
await reader.display(0);
await reader.whenIdle();
await reader.next();
book.destroy();
```

The attached HTML container needs measurable dimensions. Construction creates a scrollport without loading chapters. `display()` accepts the same chapter, href, fragment, CFI, and percentage targets as `renderTo()`. `next()` and `prev()` advance one viewport in reading order and return null at the book boundary. `viewport` exposes the native outer scrolling element.

Chapters expand into one seamless scroll surface. Horizontal text scrolls vertically; vertical text scrolls horizontally, including negative native `scrollLeft` for vertical-rl. Direction and writing-mode overrides follow the bounded reader's options. Fixed-layout XHTML retains its authored viewport and scales to the cross axis. Neighboring documents must share a block axis and progression; incompatible chapters form separately displayable segments and produce preload errors.

`preloadBefore` and `preloadAfter` each accept 1–4 chapters. Short chapters load additional neighbors to fill viewport-sized buffers. `maxViews` accepts 3–128 and must cover both configured neighbor counts and the target. Distant views are destroyed while measured extents remain available for virtual scrolling. Unloaded extents are viewport estimates, so the scrollbar length can change after loading. A native scroll into an estimated range preserves its relative chapter position. Prepending measured chapters compensates pixels without recreating retained iframe documents.

Resize, asset loads, fonts, and typography changes trigger host-scheduled reflow. A logical CFI survives repeated resizing until actual reading movement replaces it. `layout()` requests immediate remeasurement; `hide()` retains measurable geometry. Zero-sized hosts defer automatic work until geometry becomes usable again. Native chapter windows never run book scripts.

`currentLocation()` reports clipped visible CFIs and chapter boundaries, or null inside an unloaded range. `getRenderedPages()` returns intersecting pages; `getLoadedPages()` includes preloaded pages. `loadedSections`, `currentSection`, and `flowState` expose reading state. `flowState.length` includes virtual estimates. `onRelocated()` reports changed snapshots and returns an idempotent unsubscribe function.

Primary chapter failures reject `display()` and retain previously committed content. Optional neighbor failures preserve the requested readable chapter, notify `onError()`, and remain in `lastError`; `whenIdle()` rejects them. A subsequent explicit display retries and clears the retained error. New displays cancel older subscribers, and book destruction owns all readers, observers, frames, and pending subscribers. Subscriber callbacks run synchronously and should not throw.

Geometry is bounded to 1,000,000 CSS pixels per chapter and 16,000,000 per estimated book. Viewport-dependent CSS must settle within eight expansion passes; feedback growth rejects instead of hanging. Insufficient `maxViews` for a viewport of tiny chapters is reported as a preload error. This first continuous implementation uses native iframe views and estimated spacers; upstream manager/plugin compatibility remains tracked separately.

`themes` supports the same [reader style APIs](./themes.md) as the bounded reader, including updates to every currently loaded neighbor and persistence through trimming/reloading.

`interactions` supports [selection, input, and hyperlink APIs](./interactions.md) across visible/preloaded native documents. Visible chapter membership uses shared logical offsets so rounded browser rectangles cannot introduce a phantom preceding chapter at an exact boundary.

`annotations` paints [CFI highlights, underlines, and marks](./annotations.md) in a clipped host overlay. Registrations survive trimming and restore when their chapters reenter the viewport.
