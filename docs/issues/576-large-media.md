# #576 review: oversized artwork in paginated chapters

Reviewed on **2026-11-12**. Sources: [upstream report](https://github.com/futurepress/epub.js/issues/576), [figure fragmentation analysis](https://github.com/futurepress/epub.js/issues/576#issuecomment-288083129), [maintainer hook suggestion](https://github.com/futurepress/epub.js/issues/576#issuecomment-291000049), and [dimension follow-up](https://github.com/futurepress/epub.js/issues/576#issuecomment-292318048). All four comments and the reference `adjustImages()` implementation were read. Features: F13/F14/F15/F19.

Status: **Current oversized-artwork defect locally fixed**. The original book is unavailable. Folio's authored reproduction successfully navigated to the fragment before the fix, but its 1000 × 2000 image remained larger than the 320 × 240 reading viewport. This verifies clipping, not the historical claim that every navigation returns to the chapter's first page.

## Cause and compatibility decision

Column layout constrained the document but supplied no media defaults. A minimal native test failed with an actual image width of 1000 instead of at most 320. Adding only media constraints made the complete fragment/visibility test pass, separating the defect from anchor positioning and figure fragmentation.

Column-based reading now supplies zero-specificity defaults for images and outer SVG artwork: physical column size limits, contained image fitting, border-box sizing, top alignment, and break avoidance. Defaults precede publisher styles; explicit author declarations and host themes retain precedence. Dimensions, inline styles and body nodes are preserved, so CFI structure remains unchanged. Natural scrolling removes only the owned stylesheet; fixed-layout documents retain their authored geometry.

Horizontal writing also limits width to the containing block. In vertical columns, a percentage block-axis width made the initial `min()` constraint ineffective in all three tested engines; an absolute physical cap avoids that indefinite sizing case. See [CSS sizing and percentage constraints](https://www.w3.org/TR/css-sizing-3/#percentage-sizing).

These defaults do not guarantee that an oversized figure plus caption fits one page, override intentionally overflowing publisher styles, or repair all historical figure-navigation cases. Nested SVG viewports retain their own coordinates.

## Verification

- `tests/browser/issues/large-media.ts`: original generated SVG and long-text fixture, loaded through the public reader API without upstream assets.
- `tests/browser/issues/576-large-media.test.ts`: failed before the fix; verifies decoded image bounds, actual page navigation, complete visibility and unchanged width/height attributes.
- `tests/browser/render/column-media.test.ts`: spreads, resized geometry, stable CFIs, stylesheet reuse/reattachment, natural-flow restoration, author priority, host themes, intrinsic small images, outer/nested SVG, fixed layout, and both vertical writing modes.
- `tests/e2e/issue-576.spec.ts`: horizontal/vertical-rl/vertical-lr artwork with LTR and RTL in Chromium, Firefox and WebKit.

Upstream closure remains separate from this local fix.

Full validation: `pnpm check` passed with 792 unit/native DOM tests, three built-package consumer tests, and 300 end-to-end browser tests.
