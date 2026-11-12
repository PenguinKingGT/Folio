# #923 review: standard-obfuscated embedded fonts

Reviewed on **2026-11-12**. Sources: [upstream report](https://github.com/futurepress/epub.js/issues/923), [obfuscation diagnosis](https://github.com/futurepress/epub.js/issues/923#issuecomment-956297840), and [standard-algorithm follow-up](https://github.com/futurepress/epub.js/issues/923#issuecomment-1142690958). All four comments were read; the reference source contains no `encryption.xml` processing. Features: F07/F37.

Status: **IDPF font restoration locally implemented for OCF ZIP publications**. The original proprietary-font EPUB is unavailable. Adobe legacy obfuscation, directory/direct-document discovery, and other encryption algorithms remain unsupported; the complete historical report is not claimed resolved.

## Reproduction and change

An original ZIP fixture declares IDPF font obfuscation in `META-INF/encryption.xml`. Before the fix, direct resource reads returned the obfuscated bytes, and the native font loader rejected the repository-authored test font. A control confirmed the exact encoded payload and correct `font/ttf` MIME type, while the ordinary font loaded normally. This isolates the missing transformation from path selection and native font compatibility.

The byte-source adapter now recognizes standard IDPF records for declared local manifest fonts. It derives the key from the referenced raw package identifier, removes only XML whitespace, and restores the bounded prefix according to [EPUB font obfuscation](https://www.w3.org/TR/epub-33/#sec-font-obfuscation). Source/archive buffers remain unchanged. Direct reads, CSS Blob resources, and scripted data resources share the restored bytes.

Malformed XML, unsafe/ambiguous paths, duplicate targets and non-font targets declared in the selected manifest reject. Container records outside that manifest remain untouched; they may belong to another rendition. Metadata reads and restored font reads honor consumer/book cancellation. Known ZIP entries control discovery, so this feature adds no optional HTTP requests to directory or direct-document loading. Web Crypto SHA-1 is required only for recognized obfuscated fonts; unsupported environments and digest errors reject explicitly. Unknown algorithms remain untouched rather than being misinterpreted as IDPF.

## Evidence

- `tests/unit/obfuscation/idpf.test.ts`: independent SHA-1 vectors, Unicode/NBSP identifiers, key validation, 1040-byte boundaries, nonzero buffer offsets and immutable input.
- `tests/unit/obfuscation/metadata.test.ts`: namespaces, supported font MIME types, container-root/encoded paths, malformed records, traversal, remote references, duplicate and non-font rejection.
- `tests/unit/obfuscation/book.test.ts`, `source.test.ts`: direct/Blob/scripted resource bytes, repeated reads, invalid UTF-8, unrelated/unknown resources and controlled cancellation.
- `tests/browser/issues/923-obfuscated-font.test.ts`, `obfuscated-font.ts`: actual native CSS font loading and glyph metrics; the ordinary font is a control.
- `tests/e2e/issue-923.spec.ts`: both font cases in Chromium, Firefox and WebKit.

Fixtures use the original [Folio test font](../../tests/fixtures/fonts/README.md) and generated ZIP/XML under the project license, with no publisher font or book copied. Upstream closure remains separate.

Full validation: `pnpm check` passed with 853 unit/native DOM tests, three built-package consumer tests, and 306 end-to-end browser tests. No coverage thresholds or checks were reduced.

## Review follow-up: multiple OPF renditions

The initial implementation rejected every IDPF target absent from the selected manifest. Because `encryption.xml` describes the entire container, a valid second OPF's font prevented opening the default rendition. Two failing public-API reproductions now pass: an unused alternate font requires no Web Crypto, and a mixed-font container restores only the selected font while preserving the alternate font's encoded bytes. Each rendition fixture has its own identifier and manifest.

`tests/unit/obfuscation/renditions.test.ts` covers opening, chapter reading and selected/unselected font bytes. Metadata tests retain unsafe-path, duplicate and selected non-font rejection while covering records outside the selected manifest. This does not implement selecting or validating additional renditions; it prevents unrelated records from blocking the default one.

Multi-rendition validation: `pnpm check` passed with 855 unit/native DOM tests, three package consumer tests, and 306 end-to-end browser tests.

## Review follow-up: large-font restoration work

The initial `Uint8Array.from(bytes, mapper)` called JavaScript for every byte, although only 1040 bytes change. Restoration now copies the complete typed-array view natively and applies XOR only to its bounded prefix. Input storage remains unchanged, including when the caller supplies a view into a larger buffer.

`tests/unit/obfuscation/large-font.test.ts` uses a 20 MiB input to detect generic JavaScript iteration over the unchanged tail without wall-clock assertions. It checks the complete source and tail with native hashes, transformed prefix bytes, independent output storage, and nonzero input offsets. The iteration check failed before the fix with 20,971,520 visited bytes and now passes; existing short/empty/font-prefix/key-offset tests remain in place.

Run `pnpm bench:fonts` for the separate public `Book.bytes()` benchmark. It builds the library, opens an original synthetic ZIP, verifies restored bytes, discards one warm-up and records five reads. On this macOS arm64 / Node.js 24.17.0 run, the 20 MiB median fell from 683.42 ms (baseline `9793bd4`) to 2.65 ms with the checked-in benchmark command. These measurements include archive byte copying and are local observations, not CI timing requirements or cross-device guarantees.

Large-font validation: `pnpm check` passed with 857 unit/native DOM tests, three package consumer tests, and 306 end-to-end browser tests. `pnpm bench:fonts` also completed successfully.
