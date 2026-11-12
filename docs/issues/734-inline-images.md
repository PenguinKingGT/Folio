# #734: Base64 image URLs treated as archive paths

Source: [upstream #734](https://github.com/futurepress/epub.js/issues/734), [discussion](https://github.com/futurepress/epub.js/issues/734#issuecomment-497336631), queried on 2026-11-12. Feature: F07. The historical report prepends `OEBPS/` to a PNG data URI and then fails archive lookup.

Status: **Verified existing inline-image behavior for the authored archived EPUB**. No implementation change was necessary. The original EPUB and historical renderer are not claimed reproduced.

Two original canvas-generated PNG data URIs are embedded directly into chapter image attributes. Both must decode to their original one/two-pixel dimensions. Native image sources, `resources.url()` and `resources.canonical()` must retain the exact data URI rather than creating or looking up a container-relative filename. Existing document-size and passive-image policies continue to apply.

Evidence: `tests/browser/issues/734.test.ts`, shared `image-identity.ts`, and `tests/e2e/issue-734.spec.ts`. The inline case passes in native Chromium and Chromium/Firefox/WebKit end-to-end runs; the exact-file #915 and manifest-ID #951 variants are rerun alongside it. This verifies PNG data URIs specifically, not every MIME type, responsive image list, or arbitrarily large embedded payload.

Full validation: `pnpm check` passed with 779 unit/native-browser tests, three built-package consumer tests, and 276 cross-engine/mobile-emulation end-to-end tests.
