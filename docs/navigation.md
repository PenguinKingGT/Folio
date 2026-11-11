# Navigation (F08)

`parseNavigation(xml)` returns a `Navigation` instance from an EPUB 3 XHTML nav document or EPUB 2 NCX. Namespace prefixes are arbitrary; standard external doctypes are accepted without fetching DTDs.

- `toc` retains nested document order with `{ id, label, href, children }`. Grouping spans may have a null href. Labels normalize whitespace.
- `get('#item-id')` looks up an entry ID; `get(href)` accepts equivalent encoded or decoded Unicode hrefs, including target fragments. Repeated hrefs select the first entry.
- `landmarks` retains semantic type tokens, labels and destinations from EPUB 3 landmark navigation. `landmark(type)` returns the first matching destination or null.
- Empty directories are representable. Missing targets return null.

Malformed documents, missing TOC/list or NCX navMap, unlabeled entries, missing link destinations, duplicate IDs, and nesting beyond 64 levels reject instead of silently flattening or truncating the directory. NCX playOrder does not override document order. NCX pageList is tracked under F21.

Navigation hrefs remain relative to their navigation document. Resolve them against that document before passing them to OPF-relative chapter lookup. Active-link handling and external-link routing belong to F15/F25.
