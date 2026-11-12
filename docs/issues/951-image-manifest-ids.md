# #951: image resource IDs beginning with digits

Source: [upstream #951](https://github.com/futurepress/epub.js/issues/951), queried on 2026-11-12 (the full discussion contains no comments). Feature: F07. The report says a manifest image ID such as `1-image-1` selects the wrong image, while renaming the ID avoids the problem.

Status: **Verified existing resource identity for the authored identifier case**. No implementation change was necessary; the original EPUB is unavailable.

The original PNG fixture now also uses distinct IDs `1-image-1` and `2-image-2`. Both must remain present in the manifest, map to their exact hrefs, resolve to separate cached resource URLs, and decode at their own one/two-pixel widths. Images are resolved by container resource path, not by turning the manifest identifier into a CSS selector or removing punctuation.

Evidence: `tests/browser/issues/951.test.ts`, the shared authored fixture `image-identity.ts`, and `tests/e2e/issue-951.spec.ts`. Targeted checks pass in native Chromium and Chromium/Firefox/WebKit end-to-end runs; the normal-ID #915 variant is rerun alongside it.

Identifier authoring conformance and actual resource identity are separate concerns. These tests verify Folio's current handling of nonempty unique IDs; they do not assert that every tolerated ID is EPUB-schema-conformant. #915 remains a separate filename report, not a proven duplicate of this identifier report.

Full validation: `pnpm check` passed with 778 unit/native-browser tests, three built-package consumer tests, and 273 cross-engine/mobile-emulation end-to-end tests.
