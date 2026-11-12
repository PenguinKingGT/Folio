# #933: removal and unload notification

Source: [upstream #933](https://github.com/futurepress/epub.js/issues/933), [maintainer response](https://github.com/futurepress/epub.js/issues/933#issuecomment-479562010), queried on 2026-11-12. Features: F28/F29/F35.

Status: **Verified existing unload lifecycle, with an intentional API mapping**. Folio uses `book.hooks.unload` and its documented typed events, rather than promising the historical rendition `removed` event name. No implementation modification was necessary.

The existing native tests assert unload notifications match rendered documents in bounded and continuous readers. Repeated release/destruction does not notify twice. Cancellation of pending native rendering queues unload work, and `destroyAsync()` drains that work before closing shared publication resources. Unload exceptions remain observable while independent cleanup continues.

Evidence: `tests/browser/extensions/hooks.test.ts`, `lifecycle.test.ts`, and `tests/browser/lifecycle/async-close.test.ts`. Targeted validation passed 19 native-browser tests and 15 end-to-end scenarios from `tests/e2e/extensions.spec.ts` and `lifecycle.spec.ts` in Chromium, Firefox and WebKit. The unchanged implementation also passed the preceding full check.

This verifies the supported Folio lifecycle, not historical event-name compatibility or upstream closure. Applications migrating an old removal listener must adopt the unload hook documented in `docs/extensions.md`.
