# #950: preserve repeated Dublin Core metadata

Source: [upstream #950](https://github.com/futurepress/epub.js/issues/950), [discussion](https://github.com/futurepress/epub.js/issues/950#issuecomment-1031800157). Queried on 2026-11-12. Feature: F04; JSON normalization also touches F31.

The upstream report describes repeated authors, languages and subjects being flattened into one string. Folio already preserved creators, but exposed only the first language and omitted subjects and other Dublin Core values.

## Local resolution

`PackageMetadata.dublinCore` now exposes all direct Dublin Core elements, grouped by local name as readonly string arrays. Values retain source order, duplicates and normalized empty values. Namespace aliases are supported; foreign namespaces and nested extension content are excluded. Existing `title`, `language`, `identifier`, `creators` and other convenience fields retain their behavior. In particular, `identifier` still follows `unique-identifier`, rather than choosing an unrelated first identifier.

JSON manifests preserve every supplied language and supported textual Dublin Core values in the same dictionary. Creator aliases remain normalized. Missing optional JSON values are omitted; invalid new field values reject through the existing bounded JSON validators.

```ts
const metadata = book.publication.metadata;
const languages = metadata.dublinCore.language ?? [];
const subjects = metadata.dublinCore.subject ?? [];
```

Evidence: `tests/unit/package/repeated-metadata.test.ts` failed before the fix (three reproductions), then passed. It covers EPUB 2/3 repeated fields, namespace aliases, nested elements, duplicates and empty values. `tests/unit/manifest/repeated-metadata.test.ts` covers JSON language/subject preservation, invalid values and the public readonly type contract.

Status: **Locally verified fix**. Full `pnpm check` passed: 706 unit/native-browser tests, three built-package consumer tests, and 220 cross-engine/mobile end-to-end tests. No upstream closure is claimed. The package model preserves values; this change does not introduce a complete lossless XML attribute or metadata-refinement graph API.
