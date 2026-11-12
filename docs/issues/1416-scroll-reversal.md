# #1416: upward scrolling snaps back during continuous loading

Source: [upstream #1416](https://github.com/futurepress/epub.js/issues/1416), related [#1303](https://github.com/futurepress/epub.js/issues/1303). Queried on 2026-11-12. Features: F22/F23/F35.

Status: **Verified existing behavior for the authored delayed-predecessor reproduction**. No implementation modification was necessary. Related reports remain separate until their causes are established.

The scenario displays chapter four with a bounded ready window, then moves natively into an unloaded predecessor while its content preparation is held. It reverses back into chapter four and finally upward into the already loaded chapter three. Releasing the delayed predecessor must retain the final reading CFI inside the visible interval, keep chapter three current, and leave no later bounce or asynchronous error. The native view count remains bounded.

The assertion preserves the logical reading anchor rather than demanding unchanged absolute scroll pixels: measuring previously estimated chapters can legitimately change the scroll offset through compensation. Folio already disables browser scroll anchoring on its outer viewport and owns native navigation intent explicitly.

Evidence: `tests/browser/issues/1416.test.ts`, `scroll-reversal.ts`, and `tests/e2e/issue-1416.spec.ts`. The native Chromium test and four end-to-end scenarios passed in desktop Chromium, Firefox, WebKit, and Pixel 7 Chromium emulation. Emulation does not establish behavior on actual Android hardware or WebView. The original publisher file and every possible user-scroll timing remain outside this particular verification.

Full validation: `pnpm check` passed with 716 unit/native-browser tests, three built-package consumer tests, and 242 cross-engine/mobile-emulation end-to-end tests.
