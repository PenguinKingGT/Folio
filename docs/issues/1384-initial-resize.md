# #1384: resize during initial chapter loading

Source: [upstream #1384](https://github.com/futurepress/epub.js/issues/1384), queried on 2026-11-12 (no discussion comments). Features: F12/F17/F35. The report describes a blank reader after resize clears upstream views while the first display has no committed location to redisplay.

## Local verification

Status: **Verified existing behavior for the authored reproduction**. No Folio implementation change was necessary. This does not claim that the historical upstream implementation was fixed or that every possible resize race is covered.

An original long chapter is displayed at its final named anchor. A controlled content hook pauses headless preparation; a separate variant pauses native rendering. While the first display is pending, the host changes from 320 to 500 pixels and dispatches a resize. On release, the intended target must be visible in a nonblank frame with 500-pixel pagination. A subsequent native resize to 640 pixels must retain both the original document and the target.

Evidence:

- `tests/browser/issues/1384.test.ts`: both preparation boundaries and native post-commit resize observation.
- `tests/browser/issues/initial-resize.ts`: explicit hook gates and native frame synchronization, without wall-clock sleeps.
- `tests/e2e/issue-1384.spec.ts`: both variants in Chromium, Firefox and WebKit.

The tests passed against Folio's existing staged display implementation before any source modification. Assertions inspect target geometry rather than publication `atEnd`: the fixture's first chapter is not the last spine item.

Validation: full `pnpm check` passed with 708 unit/native-browser tests, three built-package consumer tests, and 226 cross-engine/mobile end-to-end tests.
