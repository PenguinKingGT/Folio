# #1264: nonnumeric page labels and href navigation

Source: [upstream #1264](https://github.com/futurepress/epub.js/issues/1264), queried on 2026-11-12 (no discussion comments). Feature: F21.

Status: **Verified existing behavior for Roman labels and href-only destinations**. No implementation change was necessary. Folio retains print labels as strings and resolves href targets into CFIs lazily rather than requiring preexisting CFIs or applying integer parsing to labels.

The authored fixture `tests/unit/pages/fixture.ts` contains the labels `iv`, `1`, and `3`, using chapter/fragment hrefs relative to a nested navigation document. Both EPUB 2 NCX and EPUB 3 page-list variants are covered. `tests/browser/render/print-pages.test.ts` verifies every generated CFI resolves to the intended native element, with lookup retaining the original label.

Validation: 24 unit/native-browser page-list tests and six `tests/e2e/print-pages.spec.ts` scenarios passed in Chromium, Firefox and WebKit. They also passed in the preceding full `pnpm check` against the unchanged implementation. This is local verification, not a claim of an upstream fix or closure.
