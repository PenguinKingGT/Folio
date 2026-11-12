# #1363 triage: authored page breaks in reading columns

Reviewed on **2026-11-12**. Sources: [report](https://github.com/futurepress/epub.js/issues/1363), [page/column explanation](https://github.com/futurepress/epub.js/issues/1363#issuecomment-1750624515), [author response](https://github.com/futurepress/epub.js/issues/1363#issuecomment-1750684517), and [later browser discussion](https://github.com/futurepress/epub.js/issues/1363#issuecomment-2691917737). All four comments were read. Related #261 is an investigation dependency, not a verified duplicate.

Status: **Valuable compatibility gap reproduced; implementation pending**. This affects publisher chapter boundaries inside a single spine document. No source fix or upstream closure is claimed. The linked original book was not downloaded; measurements use original minimal content.

## Minimal reproduction and observations

Render the following XHTML through Folio's `Book.renderTo()` in a 320 × 240 host with `{ spread: 'none', gap: 0 }`. Read each section's native `getBoundingClientRect()` after `await reader.display()`; dispose the book and host between cases.

```html
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <style>
      section {
        font: 16px/20px monospace;
        margin: 0;
        page-break-after: always;
      }
    </style>
  </head>
  <body>
    <section id="one">First</section>
    <section id="two">Second</section>
    <section id="three">Third</section>
  </body>
</html>
```

An automated Playwright diagnostic ran against the current three project browsers. Its assertion that section two starts at `left = 320` failed in all three. Replace only the final CSS declaration for the controls below; coordinates are `(left, top)` in CSS pixels.

| Declaration                          | Chromium                      | Firefox                     | WebKit           |
| ------------------------------------ | ----------------------------- | --------------------------- | ---------------- |
| `page-break-after: always`           | `(0,0)`, `(0,20)`, `(0,40)`   | Same                        | Same             |
| `break-after: page`                  | `(0,0)`, `(0,20)`, `(0,40)`   | Same                        | Same             |
| `break-after: column`                | `(0,0)`, `(320,0)`, `(640,0)` | `(0,0)`, `(0,20)`, `(0,40)` | Same as Chromium |
| `-webkit-column-break-after: always` | `(0,0)`, `(320,0)`, `(640,0)` | `(0,0)`, `(0,20)`, `(0,40)` | Same as Chromium |

The legacy property computed to `break-after: page` in all three. Column controls computed to `column` in Chromium/WebKit and `auto` in this Firefox build. These are project-browser observations, not a claim about every browser version. Temporary failing diagnostics were removed after capturing the results; they are not passing regression tests or part of the validated fix count.

## Decision

Keep this as a valuable layout backlog item. CSS distinguishes page breaks from column breaks, and [the legacy alias maps `always` to `page`](https://www.w3.org/TR/css-break-3/#page-break-properties). Folio simulates reading pages with columns. Preserving publisher chapter separation therefore requires an explicit reader compatibility policy, rather than treating valid CSS as malformed.

A declaration replacement alone cannot fix the measured Firefox case. Any implementation must address the supported engines, preserve the cascade and inline priorities, restore author behavior when switching to natural scrolling, keep CFI structure stable, and account for nested fragmentation, RTL and vertical writing. Add a permanent failing regression before that implementation. This item is not discarded, but no partial browser-specific CSS rewrite is shipped as a completed fix.
