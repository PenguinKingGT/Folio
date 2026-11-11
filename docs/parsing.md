# Publication parsing

## Container (F03)

`parseContainer(xml)` returns `{ packagePath, directory, rootfiles }`. Paths are relative to the container root, not `META-INF/`. The first rootfile with media type `application/oebps-package+xml` is selected; other OPF renditions are retained in document order.

The parser requires the OCF namespace, supports arbitrary namespace prefixes, and rejects missing/ambiguous `rootfiles`, absent package paths, directory targets, and unsafe archive paths. `directory` includes its trailing slash, or is empty for a root-level OPF.

Shared XML parsing uses `@xmldom/xmldom` without requiring browser globals. Malformed XML and parser warnings reject the input instead of recovering silently. DTD/entity declarations are rejected; XML input is capped at five million UTF-16 code units (5 × 1024 × 1024).

Original fixtures and namespace/error tests are in `tests/unit/container/`. Specification reference: [EPUB Reading Systems 3.3](https://www.w3.org/TR/epub-rs-33/).
