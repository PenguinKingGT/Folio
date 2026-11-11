# Reading order and chapters (F05)

`new Spine(publication, loader)` creates lazy `Section` instances in OPF order. The loader receives an OPF-relative href and an `AbortSignal` and returns XHTML text.

- `all()` returns an independent collection including non-linear chapters.
- `get()` selects the first linear section. Supply an index, CFI, `#idref`, or OPF-relative href to select explicitly; href fragments are ignored and Unicode encoding is normalized.
- `adjacent(index, 'next' | 'previous')` skips non-linear sections. Missing targets and reading-order boundaries return null.
- `destroy()` releases every section and prevents further access; repeated calls are safe.

Each section exposes immutable index, idref, href, linear status, and combined manifest/spine properties.

- `load(signal?)` returns a cached XHTML DOM and coalesces concurrent loads. A caller signal cancels only that caller's wait; unloading cancels the shared producer.
- `render(signal?)` serializes the DOM including caller edits.
- `unload()` clears cached content, aborts pending work, and prevents stale results from restoring the cache. Later loads start fresh.
- Failed loads, including synchronous producer exceptions, may be retried. `destroy()` is terminal and idempotent.

XHTML supports external EPUB 2 doctypes and standard XHTML entities without retrieving external DTDs. Internal DTD subsets and custom entity declarations are rejected. Returned documents use the environment-independent XML DOM; browser selection/Range conversion is tracked separately under F11.
