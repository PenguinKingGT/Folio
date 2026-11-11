# Canonical Fragment Identifiers

## Text CFI core (F10)

`new Cfi(source)` parses standard structural point and range CFIs, optionally prefixed by `#`. `toString()` serializes them without the fragment marker.

- `data` contains immutable document-indirection paths, numeric steps, escaped ID/text assertions, UTF-16 character offsets, and relative range endpoints.
- `spineIndex` is the zero-based package itemref position, or null for non-publication paths. `spineId` reads the asserted itemref ID without extension parameters.
- `isRange` distinguishes ranges. `collapse()` returns an independent point at the start; `collapse(false)` selects the end.
- `compare(other)` returns -1, 0, or 1 using numeric structural positions and offsets. It ignores assertions and compares ranges by their starts.
- `escapeCfi(text)` escapes an ID or text assertion component. Parsed assertions preserve their original escaped form, including side-bias parameters.

`Spine.get(cfi)` and `Book.section(cfi)` accept CFI targets. A matching itemref ID assertion takes precedence over the numeric index when the publication's reading order has moved.

Rejects malformed escaping, unmatched/nested assertions, invalid numeric steps, unsafe integers, offsets before indirection, backwards ranges, structural children beneath text steps, and inputs longer than 16,384 code units. Time (`~`) and spatial (`@`) termini are currently unsupported and reject rather than being silently dropped. DOM resolution and assertion recovery are covered by F11.

Reference: [EPUB Canonical Fragment Identifiers 1.1](https://w3c.github.io/epub-specs/epub33/epubcfi/). Tests use original examples under the project license.

## Native DOM conversion (F11)

- `cfiFromNode(node, { base, ignoreClass? })` generates an element/text point. `base` is a package path such as `/6/2[chapter]`, without the wrapper. Root/document/comment/detached nodes reject.
- `cfiFromRange(range, options)` generates a point for collapsed ranges or a text range otherwise. Element boundaries normalize to equivalent text boundaries where possible. Image-only/textless selections require a node CFI; endpoints must share a content ancestor.
- `rangeFromCfi(document, cfi, ignoreClass?)` resolves a native Range; `nodeFromCfi(...)` returns its starting node. The caller must supply the matching chapter document.
- Text offsets count UTF-16 code units. Adjacent text/CDATA nodes share logical slots; comments are ignored. A single `ignoreClass` makes annotation wrappers transparent without mutating the DOM.
- Element ID assertions can recover moved indices. Exact before/after text assertions can uniquely repair offsets within the same logical text slot; unresolved or ambiguous context rejects. Side bias `s=a` selects the following node at a shared boundary.
- Reversed ranges after ID recovery, missing steps/IDs, excessive text offsets, nested document indirections, and character offsets on non-text nodes reject. Whitespace-normalized or cross-element text-assertion recovery is not implemented.

Native conversion coverage runs through Vitest Browser Mode in Chromium. Selection preservation after annotation insertion also runs in Firefox and WebKit through Playwright. No simulated DOM is used for these tests.
