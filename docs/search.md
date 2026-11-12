# Chapter search (F27)

```ts
const section = book.section(0);
const matches = await section?.search('a reading phrase', {
  limit: 100,
  context: 32,
  signal: controller.signal,
});

if (matches?.[0]) {
  await reader.display(matches[0].cfi);
  reader.annotations.highlight(matches[0].cfi);
}
```

`Section.search(query, options?)` asynchronously loads the chapter when needed and searches its passive body text across arbitrary inline nodes. `find()` is an alias with the same asynchronous contract. Each frozen result contains `sectionIndex`, OPF-relative `href`, a full range `cfi`, the matched source `match`, and an `excerpt`. The returned array is also frozen. Searching requires no browser, reader, or view. Loaded headless DOM edits are reflected in subsequent searches; no stale text index is retained.

| Option                | Default | Behavior                                                             |
| --------------------- | ------- | -------------------------------------------------------------------- |
| `caseSensitive`       | `false` | Native Unicode simple case folding; source offsets are preserved.    |
| `normalizeWhitespace` | `true`  | Collapse Unicode whitespace and trim the query and corpus.           |
| `overlap`             | `false` | Include overlapping matches, advancing by a Unicode scalar.          |
| `limit`               | `100`   | Maximum results per chapter, integer from 1 to 1,000.                |
| `context`             | `32`    | UTF-16 units of excerpt context on each side, integer from 0 to 256. |
| `signal`              | —       | Cancel this consumer without cancelling other chapter consumers.     |

Queries are literal strings, including regex punctuation, and require 1–1,024 UTF-16 units with non-whitespace content. Invalid options reject before chapter I/O. Case folding is locale independent and does not expand a character into multiple characters: searching `ss` does not match `ß`. Excerpts and overlap advancement avoid splitting surrogate pairs. Excerpts add ellipses only where surrounding corpus content is omitted.

Scripts, styles, the head, and elements removed by passive rendering are excluded. Semantic block boundaries insert reading separators even in minified XHTML. A match crossing two blocks can therefore contain a normalized space while its native `Range.toString()` concatenates the underlying text nodes without that synthetic separator. CFIs still identify the exact native start and end nodes. `normalizeWhitespace: false` preserves actual whitespace and synthetic block newlines. The corpus is bounded to 2,000,000 UTF-16 units including separators and 128 nested elements; exceeding these limits rejects rather than returning incomplete results.

Unload or destruction invalidates pending results and promptly cancels consumers even if a custom loader ignores its signal. A section may be searched again after unload; destruction is terminal. Synchronous traversal is bounded and checks cancellation before indexing and between matches; it does not yield to the event loop during an individual chapter search.

Callers control whole-book aggregation, progress, and retention. For example, process chapters sequentially and release loaded bodies when no other caller needs their mutable DOM:

```ts
for (const section of book.spine.all()) {
  const matches = await section.search(query, { signal });
  consume(matches);
  section.unload();
}
```

Results can be passed directly to either reader's `display()` and annotation APIs. Unit tests cover literal matching, Unicode, normalization, limits, and cancellation; native Chromium tests and Chromium/Firefox/WebKit integration tests verify exact CFIs with and without ID assertions, navigation, and annotations.
