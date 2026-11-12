# #1408: distant chapter navigation changes after later updates

Source: [upstream #1408](https://github.com/futurepress/epub.js/issues/1408), queried on 2026-11-12. Features: F22/F23/F35. The report concerns React Native's epub.js wrapper on Android: navigation initially reaches its target, then later manager updates move it elsewhere.

Status: **Authored late-loading/reflow scenario verified; actual Android WebView reproduction still pending**. No Folio implementation modification was necessary for this scenario. Desktop or device-emulated Chromium results do not establish compatibility with the original native wrapper or Android WebView version.

The original fixture has twelve long chapters. The initial display is held by a chapter content hook; a newer explicit request then commits chapter eight's final anchor. The obsolete display must reject as cancelled. Only afterward is its shared chapter producer released. The current destination must survive both that completion and native expansion/shrinkage of chapter seven, the loaded predecessor. The test checks actual predecessor frame growth, the retained visible CFI interval, final chapter identity, physical iframe count, and asynchronous error state.

Evidence: `tests/browser/issues/1408.test.ts`, `late-navigation.ts`, and `tests/e2e/issue-1408.spec.ts`. Targeted tests pass in native Chromium, desktop Chromium/Firefox/WebKit and Pixel 7 Chromium emulation. This is stronger than checking the result of `display()` alone, but does not reproduce the original Android recording.

Remaining evidence: the affected EPUB, React Native wrapper/WebView versions, and a real Android run. Keep that platform-specific part awaiting reproduction; do not import an upstream or wrapper patch without a failing Folio case.

Full validation: `pnpm check` passed with 717 unit/native-browser tests, three built-package consumer tests, and 246 cross-engine/mobile-emulation end-to-end tests.
