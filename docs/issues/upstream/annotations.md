# Selection, annotations and search

Snapshot: 2026-11-12. Source: [futurepress/epub.js open issues](https://github.com/futurepress/epub.js/issues?q=is%3Aissue+is%3Aopen).

Feature mapping: F25–F27. Folio inspection targets: `src/annotations/, src/interaction/, src/search/`.

This is preliminary report triage, not a verified Folio defect list. Titles/bodies were collected; discussions were reviewed only for the priority items linked from the [scan overview](../upstream-scan.md). A candidate requires a local reproduction before code changes. Question routing is provisional; questions may contain real defects. Comment counts help identify unread discussion.

| Issue                                                       | Report                                                                               | Initial route                                             | Comments |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------- |
| [#1415](https://github.com/futurepress/epub.js/issues/1415) | When setting underline across paragraphs, the underline position may be incorrect    | Change candidate; reproduce first                         | 0        |
| [#1396](https://github.com/futurepress/epub.js/issues/1396) | Highlight                                                                            | Change candidate; reproduce first                         | 0        |
| [#1378](https://github.com/futurepress/epub.js/issues/1378) | highlight not working post integrating with hammer.js for swiping                    | Change candidate; reproduce first                         | 1        |
| [#1366](https://github.com/futurepress/epub.js/issues/1366) | Shift right when selection text                                                      | Change candidate; reproduce first                         | 5        |
| [#1362](https://github.com/futurepress/epub.js/issues/1362) | epubjs cfirange                                                                      | Change candidate; reproduce first                         | 1        |
| [#1355](https://github.com/futurepress/epub.js/issues/1355) | How can I add a notes icon to a book whenever I highlight paragraphs with notes?     | Question / scope review                                   | 6        |
| [#1350](https://github.com/futurepress/epub.js/issues/1350) | windows application highlight is not working                                         | Change candidate; reproduce first                         | 0        |
| [#1347](https://github.com/futurepress/epub.js/issues/1347) | Cross page highlights                                                                | Change candidate; reproduce first                         | 4        |
| [#1342](https://github.com/futurepress/epub.js/issues/1342) | Unable to change the underline color                                                 | Change candidate; reproduce first                         | 2        |
| [#1330](https://github.com/futurepress/epub.js/issues/1330) | unable to get cfi (like 'epubcfi(/6/22!/4/134,/1:0,/1:50)') from section.find("...") | Change candidate; reproduce first                         | 1        |
| [#1291](https://github.com/futurepress/epub.js/issues/1291) | How to add emojis to highlights                                                      | Question / scope review                                   | 0        |
| [#1273](https://github.com/futurepress/epub.js/issues/1273) | Highlighter, notes, thumnails                                                        | Change candidate; reproduce first                         | 0        |
| [#1262](https://github.com/futurepress/epub.js/issues/1262) | annotations.each() method error                                                      | Change candidate; reproduce first                         | 1        |
| [#1251](https://github.com/futurepress/epub.js/issues/1251) | Highlights in mobile version                                                         | Change candidate; reproduce first                         | 4        |
| [#1228](https://github.com/futurepress/epub.js/issues/1228) | CFI not matched on SELECT event of Rendition in Mobile and Desktop                   | Change candidate; reproduce first                         | 2        |
| [#1226](https://github.com/futurepress/epub.js/issues/1226) | Calling rendition.resize messes up annotations                                       | Change candidate; reproduce first                         | 0        |
| [#1213](https://github.com/futurepress/epub.js/issues/1213) | android highlight with strange view position                                         | Change candidate; reproduce first                         | 0        |
| [#1187](https://github.com/futurepress/epub.js/issues/1187) | Lib returns wrong CFI when using Range and Selection objects.                        | Change candidate; reproduce first                         | 0        |
| [#1183](https://github.com/futurepress/epub.js/issues/1183) | Highlights disappear after page turns                                                | Change candidate; reproduce first                         | 1        |
| [#1177](https://github.com/futurepress/epub.js/issues/1177) | Update annotation                                                                    | Change candidate; reproduce first                         | 3        |
| [#1164](https://github.com/futurepress/epub.js/issues/1164) | Highlights disappear after scrolling                                                 | Change candidate; reproduce first                         | 3        |
| [#1137](https://github.com/futurepress/epub.js/issues/1137) | Removing the highlights does not remove it from the rendition                        | Change candidate; reproduce first                         | 0        |
| [#1102](https://github.com/futurepress/epub.js/issues/1102) | Unable to select text on latest devices(iPhone 11 Pro) with iOS v13.4 / 13.5 .       | Change candidate; reproduce first                         | 1        |
| [#1037](https://github.com/futurepress/epub.js/issues/1037) | issue with search funcion                                                            | Change candidate; reproduce first                         | 0        |
| [#940](https://github.com/futurepress/epub.js/issues/940)   | Mathml and Highlights don't work together                                            | Change candidate; reproduce first                         | 0        |
| [#854](https://github.com/futurepress/epub.js/issues/854)   | Check if range is Highlighted                                                        | Change candidate; reproduce first                         | 2        |
| [#837](https://github.com/futurepress/epub.js/issues/837)   | section.find API failed if tag embed in querying content.                            | [Verified existing behavior](../837-cross-node-search.md) | 1        |
| [#824](https://github.com/futurepress/epub.js/issues/824)   | How to check if a selected string contains a substring of an highlight in epubjs     | Question / scope review                                   | 0        |
| [#792](https://github.com/futurepress/epub.js/issues/792)   | Searching Text not working.                                                          | Change candidate; reproduce first                         | 4        |
| [#765](https://github.com/futurepress/epub.js/issues/765)   | How to determine highlighted sentence and grab its CFI?                              | Question / scope review                                   | 2        |
| [#686](https://github.com/futurepress/epub.js/issues/686)   | -webkit-tap-highlight-color on iOS                                                   | Change candidate; reproduce first                         | 1        |
| [#619](https://github.com/futurepress/epub.js/issues/619)   | programmatically select and highlight portion of text on current page                | Change candidate; reproduce first                         | 0        |
| [#351](https://github.com/futurepress/epub.js/issues/351)   | Hypothes.is annotations on touchscreen devices                                       | Change candidate; reproduce first                         | 1        |
