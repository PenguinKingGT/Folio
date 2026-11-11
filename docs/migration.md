# epub.js Migration Tracker

Scanned on 2026-11-11 against local epub.js `0.3.93`, commit `eee359d0790002115a1156a9833c54f4bcd44c1d`. Sources: `src/`, `types/`, `examples/`, and `test/`. Rewrite capabilities without requiring the original module structure or every historical API.

## Tracking

- States: Not started → In progress → Awaiting verification → Done. Record reasons for Blocked items.
- Update each feature after implementation or verification; link implementation and tests in the evidence column.
- Done requires passing behavioral tests; layout, scrolling and selection also need real-browser tests.
- The TypeScript / Vite / pnpm / Oxlint / Prettier / test / CI foundation is complete; smoke tests do not count as EPUB features.
- Decide compatibility scope before implementing optional legacy behavior. Record excluded items as Out of scope with a reason.

**Progress: Done 20 / 36; In progress 0; Awaiting verification 0; Blocked 0; Not started 16.** Update totals with every status change; list out-of-scope items separately.

## Phase 1: Opening books and location primitives

Upstream reference: [Book](../epub.js/src/book.js), [Archive](../epub.js/src/archive.js), [Packaging](../epub.js/src/packaging.js), [CFI](../epub.js/src/epubcfi.js).

| ID  | Feature / scope                                                                                                 | Status | Implementation / tests                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| F01 | Input and requests: EPUB URL, ArrayBuffer, Base64, extracted directory, OPF; custom fetch, headers, credentials | Done   | [Source](../src/input/) / [Tests](../tests/unit/input/)                                                        |
| F02 | ZIP archives: extraction, entry access, text / Blob / Base64, resource URL creation and release                 | Done   | [Source](../src/archive/) / [Tests](../tests/unit/archive/)                                                    |
| F03 | Container: parse META-INF/container.xml and locate OPF                                                          | Done   | [Source](../src/container/) / [Tests](../tests/unit/container/)                                                |
| F04 | Package: EPUB 2/3 metadata, manifest, spine, cover and layout properties                                        | Done   | [Source](../src/package/) / [Tests](../tests/unit/package/)                                                    |
| F05 | Spine / Section: reading order, linear items, lookup, adjacent chapters, loading, serialization and unloading   | Done   | [Source](../src/spine/) / [Tests](../tests/unit/spine/)                                                        |
| F06 | Cover: EPUB 2/3 discovery, cover URL and absent-cover handling                                                  | Done   | [Source](../src/cover/) / [Tests](../tests/unit/cover/)                                                        |
| F07 | Resources: relative / encoded paths, canonical URLs, images / fonts, CSS url() / @import, Blob URLs             | Done   | [Source](../src/resources/) / [Unit](../tests/unit/resources/) / [Browser](../tests/e2e/resources.spec.ts)     |
| F08 | Navigation: EPUB 3 nav, EPUB 2 NCX, nested TOC, landmarks and href / ID lookup                                  | Done   | [Source](../src/navigation/) / [Tests](../tests/unit/navigation/)                                              |
| F09 | Headless reading: metadata, TOC, chapters and resources without creating views                                  | Done   | [Source](../src/book/) / [Unit](../tests/unit/book/) / [Browser](../tests/e2e/book.spec.ts)                    |
| F10 | CFI core: parsing, serialization, comparison, spine position, point / range CFIs and collapse                   | Done   | [Source](../src/cfi/) / [Tests](../tests/unit/cfi/)                                                            |
| F11 | CFI / DOM: Node / Range conversion, text offsets and ignored annotation wrappers                                | Done   | [Source](../src/cfi/dom.ts) / [Browser unit](../tests/browser/cfi/) / [Cross-engine](../tests/e2e/cfi.spec.ts) |

## Phase 2: Basic reading

Upstream reference: [Rendition](../epub.js/src/rendition.js), [Layout](../epub.js/src/layout.js), [Contents](../epub.js/src/contents.js), [default manager](../epub.js/src/managers/default/index.js). Requires loading and resources; CFI navigation requires F10–F11. F20 is implemented before F15 because percentage navigation depends on its full-book index.

| ID  | Feature / scope                                                                                                | Status | Implementation / tests                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F12 | Rendering: container attachment, iframe chapters, loading, visibility and scripts disabled by default          | Done   | [Source](../src/render/) / [Browser unit](../tests/browser/render/) / [Cross-engine](../tests/e2e/render.spec.ts)                                                                             |
| F13 | Reflow pagination: CSS columns, single / double pages, gaps and spread thresholds / switching                  | Done   | [Source](../src/layout/) / [Unit](../tests/unit/layout/) / [Browser](../tests/browser/render/pagination.test.ts) / [Cross-engine](../tests/e2e/pagination.spec.ts)                            |
| F14 | Scrolled reading: scrolled-doc / scrolled-continuous flow and horizontal / vertical axes                       | Done   | [Source](../src/layout/reader-layout.ts) / [Unit](../tests/unit/layout/flow.test.ts) / [Browser](../tests/browser/render/flow.test.ts) / [Cross-engine](../tests/e2e/flow.spec.ts)            |
| F15 | Navigation commands: chapter / href / anchor / CFI / percentage targets, next / previous pages across chapters | Done   | [Source](../src/render/target.ts) / [Unit](../tests/unit/render/target.test.ts) / [Browser](../tests/browser/render/navigation.test.ts) / [Cross-engine](../tests/e2e/navigation.spec.ts)     |
| F16 | Visible location: content-to-CFI mapping, start / end, displayed page, boundaries and relocated events         | Done   | [Source](../src/render/location.ts) / [Browser](../tests/browser/render/visible-location.test.ts) / [Cross-engine](../tests/e2e/visible-location.spec.ts)                                     |
| F17 | Relayout: container / orientation / image / font / media-query changes while preserving reading position       | Done   | [Source](../src/layout/reflow-observer.ts) / [Browser](../tests/browser/render/reflow.test.ts) / [Cross-engine](../tests/e2e/reflow.spec.ts)                                                  |
| F18 | Fixed layout: pre-paginated XHTML, viewport scaling, page sides and spreads                                    | Done   | [Source](../src/render/fixed-spread.ts) / [Unit](../tests/unit/layout/fixed-geometry.test.ts) / [Browser](../tests/browser/render/fixed.test.ts) / [Cross-engine](../tests/e2e/fixed.spec.ts) |
| F19 | Reading direction: LTR / RTL, vertical writing, scroll axes and page-turn direction                            | Done   | [Source](../src/layout/writing.ts) / [Unit](../tests/unit/layout/writing.test.ts) / [Browser](../tests/browser/render/writing.test.ts) / [Cross-engine](../tests/e2e/writing.spec.ts)         |

## Phase 3: Reading enhancements

Upstream reference: [Locations](../epub.js/src/locations.js), [PageList](../epub.js/src/pagelist.js), [continuous manager](../epub.js/src/managers/continuous/index.js), [Themes](../epub.js/src/themes.js), [Annotations](../epub.js/src/annotations.js). Builds on rendering and CFI.

| ID  | Feature / scope                                                                                                 | Status      | Implementation / tests                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F20 | Progress: character / word locations, CFI / index / percentage conversion, current position, save / restore     | Done        | [Source](../src/locations/) / [Unit](../tests/unit/locations/) / [Browser](../tests/browser/render/locations.test.ts) / [Cross-engine](../tests/e2e/locations.spec.ts) |
| F21 | Print pages: nav page-list / NCX pageList, page / CFI / percentage conversion                                   | Not started | —                                                                                                                                                                      |
| F22 | Continuous views: seamless chapters, preloading, trimming and scroll-position compensation                      | Not started | —                                                                                                                                                                      |
| F23 | Touch: swipe navigation, scroll snapping and mobile interaction                                                 | Not started | —                                                                                                                                                                      |
| F24 | Themes: CSS / URL / rule registration, switching, font / size and style overrides                               | Not started | —                                                                                                                                                                      |
| F25 | Content interaction: selection / Range / CFI events, input forwarding, internal and external links              | Not started | —                                                                                                                                                                      |
| F26 | Annotations: highlight / underline / mark, add / update / remove, clicks, reload restoration and relayout       | Not started | —                                                                                                                                                                      |
| F27 | Search: chapter and cross-text-node matches with excerpts and CFIs for caller-side aggregation                  | Not started | —                                                                                                                                                                      |
| F28 | Events: typed on / off / once for books, rendering, locations, selection and errors                             | Not started | —                                                                                                                                                                      |
| F29 | Extensions: asynchronous content / serialization / rendering / unload hooks, custom managers / views and styles | Not started | —                                                                                                                                                                      |

## Phase 4: Compatibility and stability

Upstream reference: [Store](../epub.js/src/store.js), [DisplayOptions](../epub.js/src/displayoptions.js), [InlineView](../epub.js/src/managers/views/inline.js), [examples](../epub.js/examples/). F35–F36 apply throughout the earlier phases, not only at the end.

| ID  | Feature / scope                                                                                                   | Status      | Implementation / tests |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------- |
| F30 | Offline: persistent resources, online / offline transitions, retrieval and URL cleanup                            | Not started | —                      |
| F31 | JSON manifest compatibility: metadata, readingOrder / spine, resources and toc                                    | Not started | —                      |
| F32 | Apple display options: fixed-layout, open-to-spread, orientation-lock, interactive and applicable behavior        | Not started | —                      |
| F33 | Inline view compatibility: determine supported non-iframe rendering and isolation boundaries                      | Not started | —                      |
| F34 | Script compatibility: explicitly authorized scripts / popups, injection and navigator.epubReadingSystem           | Not started | —                      |
| F35 | Lifecycle: load states, errors, task queues, concurrency / cancellation, idempotent cleanup of observers and URLs | Not started | —                      |
| F36 | Untrusted input hardening: traversal, malformed XML, archive limits, remote resources and script isolation        | Not started | —                      |

## Acceptance and issues

- Add success, boundary, failure and regression tests per feature. Introduce EPUB 2/3, RTL, vertical-writing and fixed-layout fixtures as their features land.
- Recheck upstream tests and examples as behavioral references; their existence does not prove correctness.
- This tracker is based on a local scan, not an upstream issue inventory. Add issue evidence under `docs/issues/` with feature IDs; a completed feature does not imply every related upstream issue is resolved.
- Reader toolbars, bookshelves, bookmark / note persistence and third-party services such as Hypothesis belong to callers or extensions rather than the core library.
