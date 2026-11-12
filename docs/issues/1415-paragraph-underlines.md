# #1415: cross-paragraph underline placement

Source: [upstream #1415](https://github.com/futurepress/epub.js/issues/1415), queried in the 2026-11-12 inventory (no discussion comments). Feature: F26. The report describes incorrect underlines spanning paragraphs; the original EPUB is unavailable and downloading the screenshot timed out during this investigation.

Status: **Locally verified fix for authored cross-paragraph reproductions**. No upstream closure or complete reproduction of the unavailable publisher file is claimed.

## Reproduction and cause

A range starts inside the first paragraph, fully selects a two-line middle paragraph, and ends inside the last paragraph. The original native test failed: the middle paragraph's first line had no underline. Captured geometry contained a 48-pixel paragraph block together with two 18-pixel text rectangles. Merging the block with its contained text replaced both line fragments with one large rectangle, so only its bottom was underlined. This isolated block geometry from iframe-coordinate projection.

Annotation geometry now reads bounded, selected native text-node subranges instead of aggregate block rectangles. It preserves partial range endpoints and rejects document-root targets, excessive traversal, or excessive native fragments before painting. A second failing reproduction showed that tight line spacing could still merge equal-width neighboring lines; geometry now supplies the writing axis so merging follows the inline axis and does not bridge distinct rows/columns.

## Evidence

- `tests/browser/issues/1415.test.ts`: normal and tight line spacing; both failed before their corresponding fixes.
- `tests/browser/issues/paragraph-underline.ts`: original three-paragraph fixture and native glyph-to-SVG stroke checks.
- `tests/browser/annotations/text-rects.test.ts`: partial selection, unrelated/empty content, document-root rejection, node/fragment bounds without mocking native geometry.
- `tests/unit/annotations/boxes.test.ts`: explicit horizontal/vertical merging cannot bridge neighboring lines.
- `tests/e2e/issue-1415.spec.ts`: both line spacings in Chromium, Firefox and WebKit.

Existing highlight, vertical-writing, transformed-host, fixed-page, and selection tests remain part of full validation. The original large paragraph block is no longer painted as text; selected text still supplies native glyph geometry rather than estimated line heights.

Full validation: `pnpm check` passed with 727 unit/native-browser tests, three built-package consumer tests, and 258 cross-engine/mobile-emulation end-to-end tests.
