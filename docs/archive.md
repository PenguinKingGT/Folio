# ZIP archives (F02)

```ts
import { Archive } from 'folio-epub';

const archive = new Archive(bytes);
const paths = archive.list();
const xml = archive.getText('META-INF/container.xml');
const imageUrl = archive.createUrl('OPS/cover.jpg');
// Release all owned Blob URLs and entry data when the book closes.
archive.destroy();
```

- Construct from `ArrayBuffer` or `Uint8Array`; directory entries are excluded from `list()`.
- `getBytes()` returns an independent copy; `getText(path, encoding?)` uses strict decoding, defaulting to UTF-8. `getBlob(path, mime?)` infers common EPUB MIME types. `getBase64()` returns raw Base64.
- `createUrl(path, { base64?, type? })` caches Blob or data URLs by path, mode, and MIME. `revokeUrl(path)` releases every cached variant for that path.
- `destroy()` releases all entries and URLs and is safe to repeat. Reads after destruction throw. Missing entries throw `RangeError`.
- Paths are container-relative literal ZIP filenames; Unicode is preserved. Traversal, absolute paths, backslashes, control characters, schemes, and duplicate entries are rejected.
- Defaults: 50 MiB compressed, 20 MiB per entry, 100 MiB total extracted, 10,000 entries. Override with `ArchiveLimits`; values must be positive safe integers.

Decompression uses `fflate` (MIT), with declared-size checks before extraction and actual-total checks afterward. This is bounded synchronous ZIP access, not a streaming decoder, DRM implementation, or complete hostile-archive audit. Additional hardening is tracked under F36.

Tests generate their own ZIP data under the project license; no upstream book fixtures are copied.
