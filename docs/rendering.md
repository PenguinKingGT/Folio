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

The container must be an attached HTML element or a CSS selector resolving to one. `renderTo()` creates one hidden iframe; `display(target?)` loads a spine chapter and returns its Section. Index, itemref ID, href, and CFI select chapters; within-chapter positioning is described under F15 below. Width/height accept positive numbers in pixels or valid CSS lengths; the default is 100%. `loadTimeoutMs` defaults to 15 seconds.

`getContents()` returns a native document after display, otherwise null. `currentSection` reports the last displayed chapter; `frame` exposes the owned iframe. Hidden readers remain hidden across display calls until `show()`.

New displays cancel older waits and stale completions never replace the active chapter. Load completion checks an operation token, so initial about:blank events cannot complete chapter loading. Network errors, cancellation, and timeouts clean listeners and timers.

Views default to `sandbox="allow-same-origin"` without script or popup permissions. Preparation removes scripts, active embeddings/forms, base tags, refresh navigation, event handlers and executable URL attributes, then inserts a restrictive CSP before author content. Assets are rewritten through the book's resource manager. HTML/SVG/MathML namespace prefixes are normalized for HTML srcdoc parsing. This mode is passive; explicit scripted publication support remains under F34, and additional security hardening remains under F36.

Destroying a reader cancels its display and removes its iframe. It leaves shared book resources available to other readers. `Book.destroy()` destroys all book-mounted readers and their resources. Constructing Rendition directly requires the caller to destroy it separately.

Tests cover native iframe rendering, dimensions, visibility, prefix normalization, script isolation, cancellation, timeout and cleanup; rendering also runs in Chromium, Firefox and WebKit.

## Reflowable pagination (F13)

Reader contents default to horizontal fixed-height CSS columns. `spread` accepts `none`, `always`, or `auto` (default); automatic spreads begin at `minSpreadWidth`, default 800 pixels. `gap` defaults to 24 CSS pixels and must be non-negative. Forced double columns must retain positive readable width.

`reader.layout({ spread, gap, minSpreadWidth })` updates current columns, or configures an unopened reader and returns null. `reader.pagination` returns immutable viewport dimensions, columns per view, column width, gap, view advance, total columns and `pageCount` (visible pages/spreads). `computePagination(width, height, options?)` exposes the DOM-independent geometry calculation.

Actual column counts come from browser overflow with a one-pixel CSSOM rounding tolerance. Final-spread padding preserves its scroll target when the last spread has an empty second column. Frames are measured with temporary hidden visibility so a hidden reader remains hidden. The host must have measurable dimensions; zero-size views reject.

Each chapter uses standards mode for consistent CSS columns and scrolling roots. Pagination sets document/body dimensions, margin/padding and column rules while retaining chapter text styling. Automatic resize preservation is described under F17; fixed layout and vertical writing remain under F18/F19.

## Scrolled flow (F14)

Set `flow` to `auto` (default), `paginated`, `scrolled-doc`, or `scrolled-continuous`. Auto honors recognized OPF rendition:flow metadata and otherwise selects pagination. Scrolled modes default to a vertical axis; `axis: 'horizontal'` enables native non-snapping column scrolling. Vertical pagination remains part of F19.

`reader.flow(mode, axis?)` switches current/future content and returns measured `flowState`, or null before display. Mode changes reset scroll position. `flowState` contains effective flow, axis, content length and viewport length. `pagination` is null while scrolling; spread settings remain available when switching back.

Vertical flow clears fixed heights and column styles, using native vertical scrolling. Horizontal flow uses fixed-height full-width columns without gaps or snapping; its scrollbar is hidden to prevent overlap with the last text line. Hidden reader measurement preserves visibility state.

Both scrolled mode values configure chapter geometry here; seamless multi-chapter management and preloading are separately tracked under F22. Current mode transitions and scroll coordinates are verified in all three browser engines.

## Reading navigation (F15)

```ts
await reader.display(0);
await reader.display('text/chapter.xhtml#introduction');
await reader.display('#introduction');
await reader.display({ href: '../text/chapter.xhtml#introduction', from: 'OPS/nav/toc.xhtml' });
await reader.display('epubcfi(/6/2[chapter]!/4/2/1:8)');
await reader.display({ percentage: 0.5 });
await reader.next();
await reader.prev();
```

Numeric targets are zero-based spine indices. String hrefs are relative to the OPF; the structured href form accepts a decoded container-relative document path as its base. Fragment-only strings prefer an exact itemref ID, then an anchor in the current chapter (or the first linear chapter before opening). Anchors support IDs and legacy named elements; URI fragments are decoded once. A chapter target without a fragment starts at its beginning. Targets outside the local spine and missing anchors reject.

CFIs resolve native content positions, including the start of a range. Pagination snaps destinations to their containing page/spread; scrolling positions the destination along its active axis, clamped to the final reachable viewport. Same-chapter navigation reuses the loaded document. Hidden readers can seek without becoming visible.

Percentage values are finite numbers from zero through one. They use `book.locations` samples and generate the default character index if needed; generate a finer index first for greater precision. An empty reading corpus rejects. New display requests cancel pending destination resolution and chapter loading.

`next()` and `prev()` return the displayed Section, or null at the publication boundary. They move one page/spread or one scrolling viewport, clamp partial final viewports, and cross linear chapters while skipping non-linear entries. Moving backward into a chapter lands on its final viewport. An unopened reader starts at the first linear chapter. RTL and vertical-writing page directions remain under F19.

## Visible reading location (F16)

```ts
const unsubscribe = reader.onRelocated((location) => {
  console.log(location.start.cfi, location.start.displayed.page);
});
await reader.display();
const location = reader.currentLocation();
unsubscribe();
```

`currentLocation()` returns null before display. Afterwards it measures immutable `start` and `end` boundaries in DOM reading order. Each boundary includes a CFI, spine index, href, displayed viewport number and total, plus sampled location and percentage when `book.locations` has an index. Reading a visible location never generates that index. `atStart` and `atEnd` describe the linear publication boundaries.

Text positions come from individual native Range rectangles intersecting both viewport dimensions. Binary searches find the first/last visible UTF-16 boundaries without probing every character; surrogate pairs stay intact. Visible image/SVG/video/canvas elements participate in reading order, and empty viewports fall back to a body CFI. Hidden readers are measured without revealing content. Scrolled page numbers use viewport-sized steps with a final partial viewport; paginated numbers count visible pages/spreads.

`onRelocated()` reports changed snapshots after display, navigation, layout, flow changes, and native scrolling. Native scroll notifications coalesce into animation frames; identical snapshots are suppressed. Subscribe before displaying to receive the initial position. Listeners run synchronously and should not throw. Unsubscribe handles are idempotent; chapter replacement and destruction remove native listeners and pending frames. General typed event registration remains under F28.

## Position-preserving relayout (F17)

Readers automatically reflow after iframe/container size changes, orientation events, captured resource load/error and media metadata events, font loading completion/failure, and changes to discovered stylesheet media conditions. Native media conditions include nested grouping rules and imports from readable stylesheets; cross-origin CSSOM rules are skipped. New dynamic styling can also request `reader.layout()` explicitly.

A logical CFI anchor survives repeated reflows instead of drifting to successive page starts. Explicit `layout()` changes preserve that anchor too; paginated views show its containing page/spread and scrolled views position it along the active axis. Stale frame dimensions and scrolled extents cannot replace the cached anchor during a pending reflow. Mode changes through `flow()` retain their documented reset-to-start behavior.

Changes coalesce into one host-window animation frame. Zero-size containers defer work until measurable, and hidden readers keep their visibility state. Scheduling uses the host realm because script-disabled WebKit frames can suppress their own callbacks. Replacing or destroying a chapter removes observers, media/font/asset listeners, and queued frames.

Tests exercise real host resizing, repeated spread/hidden changes, zero-size recovery, original image/font loading, native CSSOM import/origin behavior, and orientation cancellation. Chromium, Firefox and WebKit verify that both paginated and scrolled reading retain the original anchor through resize and media-query changes in both directions.
