# Lifecycle, hooks and performance

Snapshot: 2026-11-12. Source: [futurepress/epub.js open issues](https://github.com/futurepress/epub.js/issues?q=is%3Aissue+is%3Aopen).

Feature mapping: F17, F22, F28–F29, F35. Folio inspection targets: `src/extensions/, src/events/, src/async/`.

This is preliminary report triage, not a verified Folio defect list. Titles/bodies were collected; discussions were reviewed only for the priority items linked from the [scan overview](../upstream-scan.md). A candidate requires a local reproduction before code changes. Question routing is provisional; questions may contain real defects. Comment counts help identify unread discussion.

| Issue                                                       | Report                                                                  | Initial route                                      | Comments |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- | -------- |
| [#1405](https://github.com/futurepress/epub.js/issues/1405) | book.locations.generate() asynchronous replacement                      | Change candidate; reproduce first                  | 0        |
| [#1337](https://github.com/futurepress/epub.js/issues/1337) | open file is too slow                                                   | Change candidate; reproduce first                  | 0        |
| [#1293](https://github.com/futurepress/epub.js/issues/1293) | How to listen the chapter end ？ this project is has been this hooks ？ | Question / scope review                            | 0        |
| [#1261](https://github.com/futurepress/epub.js/issues/1261) | Lags when flipping throughthe page in epub                              | Change candidate; reproduce first                  | 0        |
| [#1178](https://github.com/futurepress/epub.js/issues/1178) | How to get CFI from a div id or class inside a Hook?                    | Question / scope review                            | 1        |
| [#1148](https://github.com/futurepress/epub.js/issues/1148) | Can anyone suggest performance testing for Epub?                        | Question / scope review                            | 0        |
| [#1117](https://github.com/futurepress/epub.js/issues/1117) | can you add a hook before display chapter                               | Question / scope review                            | 0        |
| [#1110](https://github.com/futurepress/epub.js/issues/1110) | locations.generate() slow. Can loading sections be made asynchronous?   | Question / scope review                            | 2        |
| [#933](https://github.com/futurepress/epub.js/issues/933)   | Rendition's removed event and unloaded hook isn't working               | [Verified unload contract](../933-unload-hooks.md) | 1        |
| [#913](https://github.com/futurepress/epub.js/issues/913)   | Considerable lag after epubjs tab was inactive                          | Change candidate; reproduce first                  | 4        |
| [#732](https://github.com/futurepress/epub.js/issues/732)   | How to run multiple instances on the same page ?                        | Question / scope review                            | 0        |
| [#714](https://github.com/futurepress/epub.js/issues/714)   | Books with large chapters cause extreme lag                             | Change candidate; reproduce first                  | 9        |
| [#652](https://github.com/futurepress/epub.js/issues/652)   | Cant plug in pageTurns hook                                             | Change candidate; reproduce first                  | 1        |
| [#651](https://github.com/futurepress/epub.js/issues/651)   | Opening new book after other was opened                                 | Change candidate; reproduce first                  | 0        |
| [#592](https://github.com/futurepress/epub.js/issues/592)   | Issue opening a new book                                                | Change candidate; reproduce first                  | 1        |
| [#530](https://github.com/futurepress/epub.js/issues/530)   | about hook control in Tips-and-Tricks wiki page                         | Change candidate; reproduce first                  | 0        |
| [#489](https://github.com/futurepress/epub.js/issues/489)   | Error importing smartimages Hook                                        | Change candidate; reproduce first                  | 1        |
| [#444](https://github.com/futurepress/epub.js/issues/444)   | Getting null error in hook.js 207                                       | Question / scope review                            | 0        |
| [#425](https://github.com/futurepress/epub.js/issues/425)   | epub js keeps increasing memory on each load                            | Change candidate; reproduce first                  | 0        |
