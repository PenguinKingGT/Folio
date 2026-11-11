# Publication resources (F07)

`new Resources(publication, packagePath, read, options?)` binds manifest MIME types to a byte reader. `packagePath` and reader paths are decoded container-relative paths; `read(path, signal)` returns `Uint8Array`.

- `resolve(href, from?)` resolves URI references relative to the OPF or another document. Returns a local path and fragment, or an external/inline/fragment reference. Query strings do not change local ZIP entry identity.
- `canonical(href, from?)` uses `options.canonical(path)` when provided; otherwise returns a decoded container path. Fragments are preserved.
- `url(href, from?, signal?)` creates and caches Blob URLs with manifest or inferred MIME types. CSS dependencies are recursively rewritten, including string and URL imports, images, and fonts. Import cycles reject instead of hanging.
- `rewrite(xhtml, sectionPath)` replaces `src`, `poster`, `data`, stylesheet/SVG hrefs, style elements, and inline CSS. Reader chapter links remain unchanged for navigation. This does not yet rewrite responsive `srcset` lists or sanitize active content.
- `destroy()` aborts pending work and revokes all owned URLs. Late transformations never publish URLs after destruction. One caller's signal only cancels its own wait.

Remote HTTP(S) references are rejected unless `allowRemote: true`; permitted references are retained without prefetching. Inline data and fragment references are preserved. Unsafe schemes, absolute paths, encoded separators, and traversal beyond the container root reject.

CSS uses the MIT-licensed `css-tree` parser rather than regular-expression substitution. It follows CSS parser recovery for accepted syntax and rejects reported parse errors. Rewriting is a resource transformation, not script sanitization; content security is also tracked under F12/F36.

Tests use original local resources and inspect native Blob contents, with browser checks in Chromium, Firefox, and WebKit.
