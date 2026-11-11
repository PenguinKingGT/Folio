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
