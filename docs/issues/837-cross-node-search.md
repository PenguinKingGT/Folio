# #837: search across inline-element boundaries

Source: [upstream #837](https://github.com/futurepress/epub.js/issues/837), [partial upstream fix discussion](https://github.com/futurepress/epub.js/issues/837#issuecomment-427256753), queried on 2026-11-12. Feature: F27.

Status: **Verified existing behavior for the reported search condition**. Folio's search already operates on a logical text corpus rather than searching each text node independently; no implementation modification was needed.

The authored fixture in `tests/unit/search/fixture.ts` splits a phrase across emphasis and several other inline elements and following text. Searching `original text` must return a range spanning those boundaries. `tests/browser/search/search.test.ts` resolves every returned CFI in the actual passive document and compares the native selected text to the match. The end-to-end scenario also navigates and highlights the result, with both numeric and ID-asserted CFI paths.

Validation: 16 unit/native-browser tests in `tests/unit/search/` and `tests/browser/search/`, plus six scenarios from `tests/e2e/search.spec.ts` in Chromium, Firefox and WebKit, passed. These same tests are included in the preceding full `pnpm check` on the unchanged implementation. No duplicate tests or implementation changes were added solely to rename existing coverage.

This records local behavior, not upstream closure; the historical discussion describes only a partial upstream fix.
