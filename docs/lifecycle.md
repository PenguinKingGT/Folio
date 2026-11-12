# Lifecycle and cancellation

`Book.state` reports `open`, `closing`, or `destroyed`. `Section.state` reports `unloaded`, `loading`, `loaded`, or `destroyed`; `Locations.state` reports `empty`, `generating`, `ready`, or `destroyed`. State getters remain readable after destruction. Failed chapter loads can be retried. A failed location generation preserves the previous completed index.

A newer display, theme, or location-generation intent cancels the older consumer. Aborting one consumer does not abort shared book-owned chapter or resource I/O. `Resources.rewrite(source, path, signal?)` also accepts consumer cancellation. Request cancellation combines requester-wide and per-call signals, cancels owned response streams, and settles even when a custom producer ignores cancellation.

Reader destruction cancels pending work, removes native frames, listeners and observers, and releases subscriptions. Resource and cover destruction revokes owned object URLs. Repeated destruction is safe. Destroying a reader inside a relocation callback stops the remaining callbacks and rejects its pending display.

Cleanup attempts every independent phase. Host extension failures produce an `AggregateError` after the remaining phases have run. A failed custom view destructor cannot prevent core iframe cleanup. When both an operation and its cleanup fail, the aggregate retains the primary error as `cause`.

Use `await book.destroyAsync()` when asynchronous unload hooks must finish before shared publication resources close. It waits for staged view cancellation and resulting unload callbacks, including callbacks queued while a rendering hook is cancelled. `book.destroy()` provides synchronous teardown; asynchronous hook failures remain observable through the hook lifecycle described in [Extensions](./extensions.md).

Evidence: [unit regressions](../tests/unit/lifecycle/), [native DOM regressions](../tests/browser/lifecycle/), and [three-engine scenarios](../tests/e2e/lifecycle.spec.ts).

Destroyed passive iframe views remove their `srcdoc` attribute as well as their native document reference, so a host retaining a destroyed frame does not retain the chapter source string. See [#425 regression evidence](./issues/425-retained-frame-source.md).
