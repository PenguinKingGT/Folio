# Headless books (F09)

```ts
import { Book } from 'folio-epub';

const book = await Book.open('/books/original.epub');
const title = book.publication.metadata.title;
const toc = book.navigation.toc;
const chapter = await book.section(0)?.render();
const coverUrl = await book.cover.url();
// Keep the book alive while displaying its owned resource URLs.
book.destroy();
```

`Book.open(input, options?)` accepts the F01 inputs and transport settings plus archive limits and resource policy. It opens binary/Base64 EPUB archives, EPUB URLs, extracted directories, and direct OPF URLs. Relative network inputs use `baseUrl` or the browser location; Node callers must provide an absolute URL or base. JSON manifests remain tracked under F31.

Opening reads the container, package and declared navigation. Chapter XHTML remains lazy. `publication` contains parsed metadata/manifest/spine, `navigation` contains the TOC, landmarks, and optional raw print-page links, and `packagePath` identifies the container-relative OPF. `section()` delegates indexed/ID/href lookup to the spine.

`bytes(href, from?, signal?)` and `text(href, from?, signal?)` read OPF-relative resources by default; `from` selects another decoded container-relative document path. `resources` owns transformed asset URLs; `cover` owns the cover URL. Navigation links remain relative to their navigation document. Direct OPF inputs use the origin root as the resource root because no container boundary is available.

Network requests preserve custom fetch implementations, default headers, credentials and cancellation. Remote referenced assets require `allowRemote`; primary book URLs do not. A standalone fragment is not a readable resource. XML parsing, ZIP limits and path boundaries retain their module-level checks.

`destroy()` cancels producers and releases archive data, chapters, cover and transformed URLs; repeated calls are safe. Opening failures clean up partially created sources. No iframe, reader UI, or global browser DOM is created. Integration fixtures are authored locally under the project license.

`pageList` exposes lazy printed-page indexing independently of character/word `locations`. See [printed-page APIs](./pages.md) for label, CFI, and ordinal percentage conversion. Opening a book does not resolve page-break anchors or load their chapter bodies.

`renderContinuous(target, options?)` creates a book-owned [continuous reader](./continuous.md) with seamless chapter scrolling, bounded preloading, trimming, and reading-position compensation. `renderTo()` retains the bounded chapter/spread reader.

`Section.search()` and its `find()` alias provide [headless chapter search](./search.md) with cross-node matches, excerpts, and full range CFIs. Callers choose how to aggregate chapters and retain results.

`hooks` and `renderWith()` expose trusted [host extensions](./extensions.md). Use `destroyAsync()` when asynchronous view-unload callbacks must finish before shared assets are released.
