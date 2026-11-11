# Rendering

## Passive chapter views (F12)

```ts
const reader = book.renderTo('#reader', { width: '100%', height: 600 });
await reader.display();
const document = reader.getContents();
reader.hide();
reader.show();
reader.destroy();
```

The container must be an attached HTML element or a CSS selector resolving to one. `renderTo()` creates one hidden iframe; `display(target?)` loads a spine chapter and returns its Section. Index, itemref ID, href, and CFI select chapters; within-chapter positioning is tracked under F15. Width/height accept positive numbers in pixels or valid CSS lengths; the default is 100%. `loadTimeoutMs` defaults to 15 seconds.

`getContents()` returns a native document after display, otherwise null. `currentSection` reports the last displayed chapter; `frame` exposes the owned iframe. Hidden readers remain hidden across display calls until `show()`.

New displays cancel older waits and stale completions never replace the active chapter. Load completion checks an operation token, so initial about:blank events cannot complete chapter loading. Network errors, cancellation, and timeouts clean listeners and timers.

Views default to `sandbox="allow-same-origin"` without script or popup permissions. Preparation removes scripts, active embeddings/forms, base tags, refresh navigation, event handlers and executable URL attributes, then inserts a restrictive CSP before author content. Assets are rewritten through the book's resource manager. HTML/SVG/MathML namespace prefixes are normalized for HTML srcdoc parsing. This mode is passive; explicit scripted publication support remains under F34, and additional security hardening remains under F36.

Destroying a reader cancels its display and removes its iframe. It leaves shared book resources available to other readers. `Book.destroy()` destroys all book-mounted readers and their resources. Constructing Rendition directly requires the caller to destroy it separately.

Tests cover native iframe rendering, dimensions, visibility, prefix normalization, script isolation, cancellation, timeout and cleanup; rendering also runs in Chromium, Firefox and WebKit.

## Reflowable pagination (F13)

Reader contents default to horizontal fixed-height CSS columns. `spread` accepts `none`, `always`, or `auto` (default); automatic spreads begin at `minSpreadWidth`, default 800 pixels. `gap` defaults to 24 CSS pixels and must be non-negative. Forced double columns must retain positive readable width.

`reader.layout({ spread, gap, minSpreadWidth })` updates current columns, or configures an unopened reader and returns null. `reader.pagination` returns immutable viewport dimensions, columns per view, column width, gap, view advance, total columns and `pageCount` (visible pages/spreads). `computePagination(width, height, options?)` exposes the DOM-independent geometry calculation.

Actual column counts come from browser overflow with a one-pixel CSSOM rounding tolerance. Final-spread padding preserves its scroll target when the last spread has an empty second column. Frames are measured with temporary hidden visibility so a hidden reader remains hidden. The host must have measurable dimensions; zero-size views reject.

Each chapter uses standards mode for consistent CSS columns and scrolling roots. Pagination sets document/body dimensions, margin/padding and column rules while retaining chapter text styling. Page navigation, automatic resize preservation, fixed layout and vertical writing are tracked in F15/F17/F18/F19.

## Scrolled flow (F14)

Set `flow` to `auto` (default), `paginated`, `scrolled-doc`, or `scrolled-continuous`. Auto honors recognized OPF rendition:flow metadata and otherwise selects pagination. Scrolled modes default to a vertical axis; `axis: 'horizontal'` enables native non-snapping column scrolling. Vertical pagination remains part of F19.

`reader.flow(mode, axis?)` switches current/future content and returns measured `flowState`, or null before display. Mode changes reset scroll position. `flowState` contains effective flow, axis, content length and viewport length. `pagination` is null while scrolling; spread settings remain available when switching back.

Vertical flow clears fixed heights and column styles, using native vertical scrolling. Horizontal flow uses fixed-height full-width columns without gaps or snapping; its scrollbar is hidden to prevent overlap with the last text line. Hidden reader measurement preserves visibility state.

Both scrolled mode values configure chapter geometry here; seamless multi-chapter management and preloading are separately tracked under F22. Current mode transitions and scroll coordinates are verified in all three browser engines.
