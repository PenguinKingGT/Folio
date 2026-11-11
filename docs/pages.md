# Printed pages (F21)

```ts
await book.pageList.generate({ signal });
const cfi = book.pageList.cfiFromPage('iv');
if (cfi !== null) {
  await reader.display(cfi);
}
const page = book.pageList.pageFromCfi(currentCfi);
const progress = book.pageList.percentageFromCfi(currentCfi);
```

`Book.open()` reads optional EPUB 3 `page-list` or EPUB 2 NCX `pageList` links with navigation. Generation resolves local spine hrefs and decoded fragments relative to the navigation document, without a browser or layout. It produces element CFIs against the passive XHTML tree, including canonical body placement when the source has no head. Missing/non-spine destinations and removed-content anchors reject. Direct CFI destinations are available immediately and validated against the current spine; they need no chapter reads.

`entries` contains immutable `index`, `id`, `label`, `href`, `type`, and `cfi` fields. Roman, sparse, and repeated labels remain intact. `get(label)` and `cfiFromPage(label)` choose the first matching label; numeric arguments mean printed numbers, while `at(index)` addresses document order unambiguously. A CFI query returns the preceding listed page, or null before the first marker or before resolution.

Percentages use entry order from zero through one, independently of printed numbering and the character/word progress in `book.locations`. `pageFromPercentage()`, `cfiFromPercentage()`, `percentageFromPage()`, and `percentageFromCfi()` expose these conversions. Repeated-label CFI queries preserve the actual entry index. A single listed page has zero progress; an absent page list remains empty.

`generate({ signal? })` commits the complete, nondecreasing CFI table atomically. Failures, cancellation, and superseding generation preserve previous entries. `Book.destroy()` cancels pending work and releases the table. Lists are bounded to 10,000 entries and 64 nested navigation groups. Standalone `PageList(links, resolver?)` accepts the same contracts; unresolved hrefs require a resolver.

Navigation semantics follow [EPUB 3.3 page-list](https://www.w3.org/TR/epub-33/#sec-nav-pagelist). Unit and native-browser tests cover both formats, namespaces, numbering, passive DOM recovery, bounds, errors, retries, cancellation, and cross-engine CFI navigation.
