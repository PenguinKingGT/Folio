# Covers (F06)

`new Cover(publication, loader)` uses the OPF parser's EPUB 3 `cover-image` or EPUB 2 cover meta reference. The loader receives an OPF-relative href and producer `AbortSignal`, returning a Blob.

- `path` is the declared cover path, or null.
- `url(signal?)` returns a cached Blob URL, or null without loading when no cover exists. The Blob uses the manifest MIME type. Concurrent callers share the producer.
- Per-caller cancellation does not cancel other callers. Loader failures may be retried, including synchronous exceptions.
- `revokeUrl()` releases the cached URL, invalidates pending work, and allows a fresh request.
- `destroy()` permanently releases the cover and is safe to repeat. Late results never create a URL after invalidation.

The class owns generated URLs; callers must keep it alive while displaying a returned URL. It does not store cover bytes persistently or manage reader UI. Original EPUB 2/3 and native URL lifecycle tests are in `tests/unit/cover/`.
