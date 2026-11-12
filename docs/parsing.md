# Publication parsing

## Container (F03)

`parseContainer(xml)` returns `{ packagePath, directory, rootfiles }`. Paths are relative to the container root, not `META-INF/`. The first rootfile with media type `application/oebps-package+xml` is selected; other OPF renditions are retained in document order.

The parser requires the OCF namespace, supports arbitrary namespace prefixes, and rejects missing/ambiguous `rootfiles`, absent package paths, directory targets, and unsafe archive paths. `directory` includes its trailing slash, or is empty for a root-level OPF.

Shared XML parsing uses `@xmldom/xmldom` without requiring browser globals. Malformed XML and parser warnings reject the input instead of recovering silently. DTD/entity declarations are rejected for package and container parsing; XHTML chapters allow external doctypes without fetching them, but reject internal subsets and entity declarations; XML input is capped at five million UTF-16 code units (5 × 1024 × 1024).

Original fixtures and namespace/error tests are in `tests/unit/container/`. Specification reference: [EPUB Reading Systems 3.3](https://www.w3.org/TR/epub-rs-33/).

## Package (F04)

`parsePackage(xml)` returns a `PublicationPackage`: EPUB version, metadata, a manifest map keyed by ID, indexed spine entries, page progression direction, unrefined rendition properties, and relative nav / NCX / cover paths. Paths are intentionally unresolved until the publication location is known.

Supports EPUB 2.x and 3.x OPF with namespace prefixes. Metadata exposes every direct Dublin Core value in `metadata.dublinCore`, grouped by local name as readonly arrays preserving repetitions and order. Existing primary fields remain available; multiple creators and extension entries are preserved (`name`, `value`, `id`, `refines`), and resolves the package unique identifier. EPUB 2 cover meta and EPUB 3 cover-image are recognized; missing covers return null. Spine retains non-linear entries and per-item properties.

Rejects missing required sections/attributes, title/language/identifier omissions, duplicate manifest IDs, unresolved fallback/media-overlay/spine/TOC references, empty spine, invalid linear values, and invalid reading directions. Unknown extension metadata is preserved. This parser does not implement DRM, media overlays, or fallback rendering. Tests use original OPF fixtures in `tests/unit/package/`.
