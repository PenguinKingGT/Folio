# #1367: TOC and package in different directories

Source: [upstream #1367](https://github.com/futurepress/epub.js/issues/1367), queried on 2026-11-12. Features: F07/F08/F15. The report resolves TOC-relative hrefs as though they were package-relative, causing a spine lookup failure.

Status: **Verified existing behavior through Folio's explicit-base target API**. No implementation change was necessary; treating bare TOC href strings as OPF-relative remains a caller error under the documented contract. This verification does not claim upstream closure or automatic inference of a link's originating document.

Both EPUB 2 NCX and EPUB 3 nav fixtures put the package at `OPS/package.opf`, the TOC in `OPS/navigation/`, and the chapter at `OPS/text/chapter one.xhtml`. A TOC link using `../`, a percent-encoded filename and `#end` must resolve to the correct section and visible anchor. The OPF is deliberately not at archive root.

```ts
const item = book.navigation.toc[0];
const navigationHref = book.publication.navPath ?? book.publication.ncxPath;
if (item?.href && navigationHref !== null) {
  const source = book.resources.resolve(navigationHref);
  if (source.kind === 'local') {
    await reader.display({ href: item.href, from: source.path });
  }
}
```

Evidence: `tests/browser/issues/1367.test.ts` and `tests/e2e/issue-1367.spec.ts` pass against the existing implementation. Both editions are checked in Chromium, Firefox and WebKit. These issue-specific cases verify path identity and actual anchor visibility instead of assuming equal raw href strings.

Validation: full `pnpm check` passed with 710 unit/native-browser tests, three built-package consumer tests, and 232 cross-engine/mobile end-to-end tests.
