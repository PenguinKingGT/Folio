# #1164 review: native scrolling and annotation observation

Sources: [upstream #1164](https://github.com/futurepress/epub.js/issues/1164), [pane recreation analysis](https://github.com/futurepress/epub.js/issues/1164#issuecomment-754621925), [click-restoration follow-up](https://github.com/futurepress/epub.js/issues/1164#issuecomment-756068987), and [continuous-manager distinction](https://github.com/futurepress/epub.js/issues/1164#issuecomment-756865271), queried on 2026-11-12. Features: F16/F17/F25/F26/F35.

Status: **Current local WebKit scroll-observation defect fixed; authored continuous trim/restore condition verified**. The historical upstream pane implementation and original React Native publisher file are not claimed fixed or fully reproduced.

## Valuable current defect

A real wheel gesture over a passive `scrolled-doc` iframe moved its document by more than 100 pixels in WebKit, while no relocated event arrived and the highlight remained painted at its old position. The same test passed in Chromium and Firefox before the fix. An inert diagnostic event was also suppressed; direct geometry measurement worked, and manual annotation refresh removed the offscreen shapes. This isolated callback delivery from SVG projection and snapshot deduplication.

Folio now probes callback delivery with a temporary inert event, removing its listener immediately. Event-capable documents keep native event observation. When callbacks are suppressed, a cancellable host animation-frame monitor compares two native scroll offsets and schedules location/geometry work only after movement. It never enables publication scripts or relies on browser names. Background scheduling follows the host's native animation-frame lifecycle.

Changed CFIs still produce deduplicated relocation notifications. Native scroll work can also refresh geometry when those CFIs remain unchanged. Frame replacement, reader destruction, and destruction from a notification cancel queued monitoring and release the native window reference.

## Historical condition and evidence

The upstream discussion identifies stale `marks-pane` ownership after continuous iframe recreation. Folio uses a reader-owned host SVG instead. A separate real wheel scenario scrolls beyond the original chapter until that frame is trimmed, then returns and verifies the registered highlight is visible again.

- `tests/e2e/issue-1164.spec.ts`: before-fix WebKit failure, passing wheel relocation/clipping/restoration, and continuous native trim/restoration in Chromium/Firefox/WebKit.
- `tests/browser/render/native-scroll.test.ts`: real iframe offsets, idle deduplication, capability-listener cleanup, destruction, callback-time destruction, missing schedulers/windows, and stale queued callback cancellation.
- `tests/browser/render/relocation.test.ts`: unchanged CFI snapshots still notify visual consumers without emitting duplicate reading positions.
- Existing lifecycle regressions verify subscriber-driven destruction and asynchronous cleanup.

This scroll-specific fallback does not provide native click/input/selection forwarding where the browser suppresses those callbacks; explicit host interaction APIs retain their documented role. Original unavailable platform/file details remain separate from the reproduced current defect.

Validation: `pnpm check` passed, including 784 unit/native DOM tests, three package consumer tests, and 282 end-to-end browser tests.
