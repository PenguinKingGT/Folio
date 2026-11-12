# #1326: previous chapter after font-size changes

Source: [upstream #1326](https://github.com/futurepress/epub.js/issues/1326), related [#1325](https://github.com/futurepress/epub.js/issues/1325), queried on 2026-11-12. Features: F13/F15/F17/F24. These remain related reports, not proven duplicates.

Status: **Verified existing behavior for authored 80%/120% font-size reproductions**. No implementation modification was necessary.

The fixture has a long first chapter, a nonlinear appendix, and a short following linear chapter. After displaying the following chapter and applying either relative font size, `prev()` must select the previous linear chapter's final page. The final anchor must be visible; the next forward turn must return to the following linear chapter without skipping or replaying pages. Native computed font sizes are checked to ensure the theme actually affects the text.

Evidence: `tests/browser/issues/1326.test.ts` and `tests/e2e/issue-1326.spec.ts`, using the original fixture in `tests/browser/render/navigation-fixture.ts`. The sequence also exercises skipping a nonlinear spine entry. Validation does not claim that unavailable publisher fixtures, delayed third-party assets, or every asynchronous font-loading race have been reproduced.

Validation: full `pnpm check` passed with 712 unit/native-browser tests, three built-package consumer tests, and 238 cross-engine/mobile end-to-end tests.
