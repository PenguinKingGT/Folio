# Publication resources (F07)

`new Resources(publication, packagePath, read, options?)` binds manifest MIME types to a byte reader. `packagePath` and reader paths are decoded container-relative paths; `read(path, signal)` returns `Uint8Array`.

- `resolve(href, from?)` resolves URI references relative to the OPF or another document. Returns a local path and fragment, or an external/inline/fragment reference. Query strings do not change local ZIP entry identity.
- `canonical(href, from?)` uses `options.canonical(path)` when provided; otherwise returns a decoded container path. Fragments are preserved.
- `url(href, from?, signal?)` creates and caches Blob URLs with manifest or inferred MIME types. CSS dependencies are recursively rewritten, including string and URL imports, images, and fonts. Import cycles reject instead of hanging. External stylesheets are limited to 1 MiB each and dependency traversal to 16 levels.
- `rewrite(xhtml, sectionPath, signal?)` replaces `src`, `poster`, `data`, stylesheet/SVG hrefs, style elements, and inline CSS. Reader chapter links remain unchanged for navigation. This does not yet rewrite responsive `srcset` lists or sanitize active content.
- `destroy()` aborts pending work and revokes all owned URLs. Late transformations never publish URLs after destruction. One caller's signal only cancels its own wait.

Remote HTTP(S) references are rejected unless `allowRemote: true`; permitted references are retained without prefetching. Inline data and fragment references are preserved. Unsafe schemes, absolute paths, encoded separators, and traversal beyond the container root reject.

CSS uses the MIT-licensed `css-tree` parser rather than regular-expression substitution. It follows CSS parser recovery for accepted syntax and rejects reported parse errors. Rewriting is a resource transformation, not script sanitization; content security is also tracked under F12/F36.

Tests use original local resources and inspect native Blob contents, with browser checks in Chromium, Firefox, and WebKit.

## Standard font obfuscation (F37)

Opening an OCF ZIP publication recognizes IDPF font records in `META-INF/encryption.xml`. Manifest-declared local fonts are restored before resource delivery, including direct `Book.bytes()` reads, CSS Blob URLs and scripted embedded resources. The package identifier determines the standard key; original ZIP/offline bytes remain unchanged. The encryption list is container-wide: safe records outside the selected manifest remain untouched, including fonts belonging to other OPF renditions. Only selected fonts use the selected package identifier. Malformed recognized records, unsafe paths, duplicate targets and selected non-font targets reject opening.

This feature requires Web Crypto SHA-1 support (supported Node.js or a secure browser context) when recognized obfuscated fonts exist. It adds no dependency or global crypto fallback. Unknown encryption algorithms remain untouched; Adobe legacy obfuscation, DRM and encryption discovery for extracted directories/direct OPF/JSON are unsupported. See [#923 evidence and limits](./issues/923-font-obfuscation.md).

Font restoration copies the input view into independent storage and limits JavaScript XOR work to the first 1040 bytes. Large-font correctness/work regressions run in the normal test suite; `pnpm bench:fonts` separately measures public 20 MiB resource reads without imposing timing thresholds on CI.
