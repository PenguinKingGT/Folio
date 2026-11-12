# Upstream open-issue scan

Query date: **2026-11-12**. Repository: [futurepress/epub.js](https://github.com/futurepress/epub.js/issues). Scope: **486 open issues**, excluding **32 pull requests** returned by the same API. Six pages were retrieved to the end using `GET /repos/futurepress/epub.js/issues?state=open&per_page=100&sort=created&direction=desc`. Closed issues and pull-request reviews were not inventoried. Counts describe this snapshot, not a permanent repository total.

## What needs work

Prioritize current, reproducible reading blockers, security/data-loss defects, resource leaks, and significant performance or cross-browser regressions. Questions, obsolete-version reports, and already-correct behavior remain triage entries; they do not automatically require implementation changes or dedicated new tests. Reuse existing evidence when it establishes the requested behavior.

The [priority assessment](./upstream-priority.md) lists concrete reports, expected behavior, proposed changes or verification tasks, and local inspection targets. Start with security boundaries, loading failures, resize/display races, scrolling correctness, and data loss. A report against epub.js does not establish that Folio has the same defect.

- **Implementation candidates:** [#950 metadata preservation](./950-repeated-metadata.md) now has a local fix; investigate reported navigation, position, annotations and lifecycle defects with issue-specific tests. An existing F01–F36 capability is not sufficient evidence of resolution.
- **Verification first:** reproduce each candidate against Folio and the referenced upstream behavior with an original minimal fixture. Read remaining discussion before changing code. If Folio already behaves correctly, record that specific test instead of changing code unnecessarily.
- **Compatibility decisions:** inline publisher HTML (#1381 and related reports) remains excluded by [F33](../view-compatibility.md). [#1420](./1420-empty-doctype.md) now permits only inert empty bare XHTML subsets after a compatibility review; other DTD/entity subsets remain excluded under [F36](../security.md).
- **Scope additions:** SMIL/media-overlay playback (#1043, #1289) and publisher alternate-stylesheet selection (#586) need explicit scope/API decisions. Parsing a manifest overlay attribute or registering host themes is not equivalent to implementing those features.
- **Host/infrastructure work:** signing cookies/CORS, DRM/password handling, native context menus, page-turn animations and third-party website maintenance must be separated from reproducible core defects. A question is not automatically out of scope.

## Full inventory

Every open issue is listed once below. The routing is preliminary, using report titles and body collection; it is not a manual review of every discussion. Individual reports may span several features; the assigned group is an inspection starting point. Question and change-candidate labels are heuristic and require confirmation.

| Group                                                           | Issues  | Folio feature mapping          |
| --------------------------------------------------------------- | ------- | ------------------------------ |
| [Security and isolation](./upstream/security.md)                | 20      | F12, F33–F36                   |
| [Loading, resources and offline access](./upstream/loading.md)  | 88      | F01–F07, F09, F30–F32          |
| [Navigation, CFI and progress](./upstream/navigation.md)        | 63      | F08, F10–F11, F15–F16, F20–F21 |
| [Layout, scrolling and reading direction](./upstream/layout.md) | 114     | F13–F19, F22–F23               |
| [Selection, annotations and search](./upstream/annotations.md)  | 33      | F25–F27                        |
| [Themes, fonts and publisher CSS](./upstream/styles.md)         | 29      | F07, F17, F24                  |
| [Lifecycle, hooks and performance](./upstream/lifecycle.md)     | 19      | F17, F22, F28–F29, F35         |
| [Types, build and host integrations](./upstream/packaging.md)   | 23      | F01, F09, F28–F29              |
| [Documentation, ecosystem and scope](./upstream/docs-scope.md)  | 97      | Scope review                   |
| **Total**                                                       | **486** |                                |

## Status and evidence rules

Priority items distinguish **Change candidate**, **Awaiting reproduction**, **Design difference**, and **Scope decision**. The initial scan marked no issue verified, duplicate or closed. Subsequent local fixes are linked from the priority assessment and inventory; upstream closure remains separate. Similar reports are related candidates until their causes are proven identical.

For each implementation task, record an original reproduction fixture, a test that fails before the fix, the passing regression, relevant browser engines, and the local commit. Keep upstream state separate from local verification. Missing attachments, platform details or unresolved discussion must remain explicit evidence gaps.

The feature tracker remains complete for its original scoped migration. This issue inventory is a separate backlog and may reveal missing subfeatures. The local repository remains the implementation target; the nested upstream checkout has not been modified.

## Local verification progress

| Issue | Local result                                                              | Evidence                                                        |
| ----- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| #950  | Implementation fixed                                                      | [Repeated metadata](./950-repeated-metadata.md)                 |
| #1384 | Existing behavior verified                                                | [Initial resize](./1384-initial-resize.md)                      |
| #1367 | Explicit-base behavior verified                                           | [Nested navigation](./1367-nested-navigation.md)                |
| #837  | Existing behavior verified                                                | [Cross-node search](./837-cross-node-search.md)                 |
| #1264 | Existing behavior verified                                                | [Print labels](./1264-print-page-labels.md)                     |
| #933  | Unload contract verified                                                  | [Unload hooks](./933-unload-hooks.md)                           |
| #1326 | Font-boundary behavior verified                                           | [Previous page after reflow](./1326-font-boundary.md)           |
| #1200 | Malformed input rejected; valid ordering verified                         | [CFI comparison](./1200-cfi-order.md)                           |
| #1416 | Delayed native reversal verified                                          | [Scroll anchoring](./1416-scroll-reversal.md)                   |
| #1408 | Late updates verified; actual Android WebView pending                     | [Distant navigation](./1408-late-navigation.md)                 |
| #425  | Source retention fixed; original large-book heap case pending             | [Frame source release](./425-retained-frame-source.md)          |
| #1415 | Cross-paragraph underline geometry fixed                                  | [Text-line fragments](./1415-paragraph-underlines.md)           |
| #1405 | Bounded parallel location reads implemented                               | [Parallel generation](./1405-parallel-locations.md)             |
| #1420 | Inert empty XHTML subset normalized safely                                | [DOCTYPE compatibility](./1420-empty-doctype.md)                |
| #1197 | Production audit verified; original advisory mapping pending              | [XML dependency baseline](./1197-xml-dependency-audit.md)       |
| #915  | Exact dotted/undotted image identity verified                             | [PNG filename regression](./915-image-filenames.md)             |
| #951  | Leading-digit image ID identity verified                                  | [Manifest ID regression](./951-image-manifest-ids.md)           |
| #734  | Inline PNG data URI decoding verified                                     | [Embedded images](./734-inline-images.md)                       |
| #1164 | Current WebKit scroll observation fixed; continuous trim/restore verified | [Native scroll annotations](./1164-native-annotation-scroll.md) |

[#1363](./1363-page-break-triage.md) has a reproduced page/column compatibility gap and remains pending; it is not included among verified fixes.

[#576](./576-large-media.md) review fixed current oversized-artwork clipping; the original unavailable-book navigation report remains separate.

Other inventory entries are not claimed locally resolved. No upstream issue has been closed by this work.
