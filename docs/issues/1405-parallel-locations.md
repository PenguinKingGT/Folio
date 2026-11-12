# #1405: sequential location generation reads

Source: [upstream #1405](https://github.com/futurepress/epub.js/issues/1405), related [#1110](https://github.com/futurepress/epub.js/issues/1110). Queried in the 2026-11-12 inventory; #1405 has no discussion comments. Features: F20/F35. Related performance reports are not presumed duplicates.

Status: **Locally verified bounded parallel-I/O implementation**. The report's machine-specific 19.6-second/0.5-second timings and original publication have not been independently reproduced.

## Change

Folio previously awaited each chapter read before starting the next. A controlled test failed before the fix because only the first producer started while it was held, despite requesting concurrency two.

`locations.generate({ concurrency })` now prefetches a bounded window of linear chapter XHTML. Concurrency defaults to four and must be an integer from one through sixteen; one selects serial reads. Results are consumed and sampled in spine order, preserving chapter boundaries, character/word totals and cross-chapter sampling intervals regardless of completion order. Nonlinear chapters remain excluded. The window bounds completed-but-unconsumed sources as well as pending reads; it never queues the whole book. Existing XML size/entity limits are checked before buffering markup.

Any read failure cancels siblings immediately, including when an earlier custom producer ignores cancellation. Parser failure and early iterator exit also cancel remaining work. Every producer has a rejection handler; failed or cancelled generations retain the preceding completed index. No partial index is published. Parsing and sampling still run sequentially on the calling thread; this is I/O concurrency, not a worker-based CPU speedup. Execution concurrency is not persisted in location snapshots.

## Evidence

- `tests/unit/locations/concurrency.test.ts`: before-fix failure, concurrent start, reverse completion and ordered samples.
- `concurrency-bounds.test.ts`: default/explicit limits, ready-buffer bounds, invalid settings, and byte-for-byte serial/parallel character and word samples.
- `concurrency-errors.test.ts`: later failure behind an uncooperative earlier producer, parser cleanup, caller cancellation and atomic index retention.
- `tests/e2e/issue-1405.spec.ts`: real native HTTP requests for two chapters are observed before either response is released; resulting CFIs remain ordered and indexing allocates no reader frames. Passes Chromium, Firefox and WebKit.

The older superseding-generation test now explicitly waits for its first producer to start before issuing the newer request. This preserves its intended ignored-cancellation scenario instead of relying on synchronous loader invocation during construction.

Full validation: `pnpm check` passed with 744 unit/native-browser tests, three built-package consumer tests, and 261 cross-engine/mobile-emulation end-to-end tests.
