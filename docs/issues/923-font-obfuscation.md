# #923 review: standard-obfuscated embedded fonts

Reviewed on **2026-11-12**. Sources: [upstream report](https://github.com/futurepress/epub.js/issues/923), [obfuscation diagnosis](https://github.com/futurepress/epub.js/issues/923#issuecomment-956297840), and [standard-algorithm follow-up](https://github.com/futurepress/epub.js/issues/923#issuecomment-1142690958). All four comments were read; the reference source contains no `encryption.xml` processing. Features: F07/F37.

Status: **IDPF font restoration locally implemented for OCF ZIP publications**. The original proprietary-font EPUB is unavailable. Adobe legacy obfuscation, directory/direct-document discovery, and other encryption algorithms remain unsupported; the complete historical report is not claimed resolved.

## Reproduction and change

An original ZIP fixture declares IDPF font obfuscation in `META-INF/encryption.xml`. Before the fix, direct resource reads returned the obfuscated bytes, and the native font loader rejected the repository-authored test font. A control confirmed the exact encoded payload and correct `font/ttf` MIME type, while the ordinary font loaded normally. This isolates the missing transformation from path selection and native font compatibility.

The byte-source adapter now recognizes standard IDPF records for declared local manifest fonts. It derives the key from the referenced raw package identifier, removes only XML whitespace, and restores the bounded prefix according to [EPUB font obfuscation](https://www.w3.org/TR/epub-33/#sec-font-obfuscation). Source/archive buffers remain unchanged. Direct reads, CSS Blob resources, and scripted data resources share the restored bytes.

Malformed XML, unsafe/ambiguous paths, duplicate targets and non-font targets reject. Metadata reads and restored font reads honor consumer/book cancellation. Known ZIP entries control discovery, so this feature adds no optional HTTP requests to directory or direct-document loading. Web Crypto SHA-1 is required only for recognized obfuscated fonts; unsupported environments and digest errors reject explicitly. Unknown algorithms remain untouched rather than being misinterpreted as IDPF.

## Evidence

- `tests/unit/obfuscation/idpf.test.ts`: independent SHA-1 vectors, Unicode/NBSP identifiers, key validation, 1040-byte boundaries, nonzero buffer offsets and immutable input.
- `tests/unit/obfuscation/metadata.test.ts`: namespaces, supported font MIME types, container-root/encoded paths, malformed records, traversal, remote references, duplicate and non-font rejection.
- `tests/unit/obfuscation/book.test.ts`, `source.test.ts`: direct/Blob/scripted resource bytes, repeated reads, invalid UTF-8, unrelated/unknown resources and controlled cancellation.
- `tests/browser/issues/923-obfuscated-font.test.ts`, `obfuscated-font.ts`: actual native CSS font loading and glyph metrics; the ordinary font is a control.
- `tests/e2e/issue-923.spec.ts`: both font cases in Chromium, Firefox and WebKit.

Fixtures use the original [Folio test font](../../tests/fixtures/fonts/README.md) and generated ZIP/XML under the project license, with no publisher font or book copied. Upstream closure remains separate.

Full validation: `pnpm check` passed with 853 unit/native DOM tests, three built-package consumer tests, and 306 end-to-end browser tests. No coverage thresholds or checks were reduced.
