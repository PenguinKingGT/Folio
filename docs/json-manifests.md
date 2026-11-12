# JSON manifest compatibility (F31)

`Book.open('/publication/manifest.json')` detects JSON URLs. Use `{ type: 'json' }` for endpoints without a `.json` extension. `baseUrl`, custom fetch, headers, credentials, cancellation, resource policy, and offline stores retain their existing behavior. The JSON document replaces container/OPF discovery; chapters remain lazy XHTML resources relative to that document.

```json
{
  "metadata": {
    "identifier": "original-publication",
    "title": "Original publication",
    "language": "en",
    "author": [{ "name": "Original Author" }]
  },
  "readingOrder": [
    { "id": "chapter", "href": "text/chapter.xhtml", "type": "application/xhtml+xml" },
    { "href": "notes.xhtml", "linear": false }
  ],
  "resources": [{ "href": "images/cover.jpg", "type": "image/jpeg", "rel": ["cover"] }],
  "toc": [{ "title": "Chapter", "href": "text/chapter.xhtml#start" }]
}
```

This implements the epub.js-style JSON publication boundary; it does not claim complete compatibility with every Web Publication or Readium manifest vocabulary. `parseJsonManifest(textOrObject)` is also exported for headless normalization and returns `{ publication, navigation }` without mutating its input. An absent inline directory returns `navigation: undefined` so Book can load a declared nav/NCX resource.

- Metadata requires non-empty string `identifier` and `title`, plus a string `language` or non-empty language array (the first becomes the primary language). Optional `description`, `publisher`, `date`, and `rights` may be empty. `creators`, `author`, and legacy `creator` accept a name string or an array of strings/objects with `name`, in that precedence order.
- `readingOrder` takes precedence over the legacy `spine` alias and must contain at least one XHTML entry. Entries accept `href`, optional `id`, `type`/`mediaType`, `properties`, and `linear` (`true`/`false` or `yes`/`no`). XHTML is the default reading-order media type. An `idref` can reuse a declared resource without repeating its href. Reusing an ID with a different href/media type rejects. Resource-level properties are retained independently of spine overrides.
- `resources` is optional. Entries have `href`, optional `id`, `type`/`mediaType` (otherwise inferred by extension), `properties`, `rel`, `fallback`, and `mediaOverlay`. References must resolve to declared IDs. Resource IDs must be unique. `rel: cover` maps to `cover-image`; `rel: contents` maps to `nav`. Missing identities are generated deterministically without colliding with existing IDs.
- Properties/relationships accept token strings or arrays. `metadata.direction` or `readingProgression` accepts `ltr`, `rtl`, or `default`. `layout`, `flow`, `spread`, and `orientation` may be supplied directly in metadata or under `metadata.rendition`; nested values take precedence. `layout: fixed` normalizes to `pre-paginated`.
- Inline `toc` entries have `title`/`label`, optional `id`, `href`, and nested `children`/legacy `subitems`. Group headings can omit href when they contain children. Optional `landmarks` accept semantic `rel`/`types`, title, and href. Optional `pageList` accepts title/label, href, optional ID and type. Inline links use the JSON document as their base, including when a separate nav asset is declared. Without inline navigation, EPUB nav/NCX loading remains available.

Normalized packages use the canonical `/6` spine step, producing stable CFIs from explicit/generated IDs and reading-order indexes. Search, locations, print pages, both native readers, themes, annotations, and host hooks use the same modules as EPUB sources. Chapter scripts remain disabled. Direct JSON URLs use the origin root as their resource boundary, matching direct OPF sources; no ZIP container boundary is inferred.

JSON text is limited to 5 MiB, arrays to 10,000 entries, individual strings to 16,384 UTF-16 units, and hrefs to 4,096 units. Navigation permits at most 10,000 total entries and 32 nested levels; cyclic host objects reject through the same bounds. Invalid types, explicit null values in supported fields, duplicate IDs, malformed escapes, unsafe schemes, and unresolved resource references reject. Unsupported metadata vocabularies and extra fields are not interpreted.

Tests cover legacy aliases, metadata, lazy loading, references, nonlinear chapters, inline/external navigation, printed-page bases, hostile/bounded input, failure cleanup, and native range-CFI/rendering/isolation behavior in Chromium, Firefox, and WebKit.
