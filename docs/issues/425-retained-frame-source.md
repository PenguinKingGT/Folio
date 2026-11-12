# #425: retained source after repeated book closure

Source: [upstream #425](https://github.com/futurepress/epub.js/issues/425), queried on 2026-11-12 (no discussion comments). Features: F02/F07/F22/F35. The original report concerns roughly 100 MB books and memory growth in a historical Chrome Packaged App.

## Local fix

Status: **Locally fixed source-retention path; original large-book heap report not fully reproduced**.

Investigation found a concrete Folio retention path: `IframeView.destroy()` detached its iframe and cleared its document reference, but left the complete chapter in the iframe's `srcdoc` attribute. The public view/frame can remain referenced by host code after destruction, retaining that chapter-sized string even after archive/resource cleanup.

Destruction now removes `srcdoc` after detaching the frame and releases its completed loading controller. Repeated destruction remains safe. This change applies to both bounded and continuous passive readers, including the core cleanup fallback for custom views. It does not change the scripted reader's separate teardown policy.

## Regression evidence

`tests/browser/issues/425.test.ts` first failed against the previous implementation: a destroyed view's `srcdoc` still contained the authored chapter. It passes after the fix and checks both the source property and attribute are empty/absent while the host still retains the view.

`tests/browser/issues/repeated-close.ts` performs eight open/display/close cycles for each reader mode. It deliberately retains every iframe reference and verifies all are detached and have no source attribute. Each cycle creates real cover and resource Blob URLs, fetches them before closure, waits for asynchronous teardown, repeats synchronous destruction, and verifies both URLs reject new fetches afterward. An authored approximately 250 KB comment makes source retention observable without expensive text layout.

The three native Chromium tests and six scenarios in `tests/e2e/issue-425.spec.ts` pass in Chromium, Firefox and WebKit. The assertions test deterministic resource ownership, not immediate garbage collection, browser process RSS, or an inferred heap threshold. The original publisher EPUB and Chrome Packaged App environment remain unavailable; no full upstream resolution or closure is claimed.

Full validation: `pnpm check` passed with 720 unit/native-browser tests, three built-package consumer tests, and 252 cross-engine/mobile-emulation end-to-end tests.
