# Reading progress (F20)

```ts
await book.locations.generate({ unit: 'characters', breakSize: 150 });
const cfi = book.locations.cfiFromPercentage(0.5);
if (cfi !== null) {
  book.locations.setCurrent(cfi);
}
const saved = book.locations.save();
book.locations.load(saved);
```

`Book.locations` is a headless `Locations` instance. Explicit generation reads linear spine chapters without retaining their Section DOM caches. Options include `unit` (`characters` by default, or `words`), positive integer `breakSize` (150 characters / 50 words by default), and an AbortSignal.

- `entries`, `length`, `total`, `unit`, `breakSize`, and `current` describe the current immutable sampled index. Total counts reading units, not samples.
- `locationFromCfi()` finds a preceding sample; unknown/non-linear chapters and empty indexes return null.
- `cfiFromLocation()` returns a sample CFI or null; `percentageFromLocation()` returns weighted progress and rejects invalid indexes.
- `percentageFromCfi()` returns sampled progress or null; `cfiFromPercentage()` selects a preceding sample for a finite value in [0, 1]. Precision depends on breakSize.
- `setCurrent(indexOrCfi)` updates the current sample. `save()` emits versioned JSON; `load(unknown)` validates publication identity, units, limits, CFI order, endpoints, positions and current index before replacing state.

Character positions use UTF-16 units and never split surrogate pairs. Text slots merge adjacent text/CDATA across comments and removed active elements. Formatting-only whitespace and style/script text are excluded; block separators contribute logical newlines. Unicode word segmentation spans inline markup and respects block separators, using publication language with an ICU fallback for malformed language tags.

CFIs use the actual OPF spine step and itemref IDs. Corpus extraction shares the reader's passive element policy; every sampled point is verified against native rendered documents, including CDATA normalization. This is content progress independent of layout and CSS visibility, not a count of displayed pages.

New generations supersede older ones; cancellation and failures do not publish partial results. Cancelled waits reject promptly even if a custom producer ignores its signal. Destroying the book cancels indexing and releases samples.

Indexes are limited to 100,000 samples and serialized snapshots to 10,485,760 UTF-16 code units. Choose coarser intervals for large books. Snapshots identify a publication by its identifier; source-content changes are not fingerprinted, so callers must regenerate after editing book content. Empty text/word corpora produce no locations. Saved samples must belong to linear chapters, matching generated indexes and lookup behavior.
