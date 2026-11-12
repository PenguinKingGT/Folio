# #915: dotted and undotted image filenames

Source: [upstream #915](https://github.com/futurepress/epub.js/issues/915), [maintainer request for context](https://github.com/futurepress/epub.js/issues/915#issuecomment-470752311), queried on 2026-11-12. Feature: F07. The report says `17.3.png` and `173.png` both display the first image; its discussion supplies no book or archive/cross-origin details.

Status: **Verified existing behavior for the authored archived EPUB case**. No implementation modification was necessary, and the missing original environment is not claimed reproduced.

The fixture generates two original PNGs with native canvas: red at one pixel wide, blue at two pixels wide. They are stored under the exact reported filenames, declared as distinct manifest resources, and referenced relatively from a chapter. Native decoded widths must remain `[1, 2]`; generated resource URLs must be distinct and each native image source must equal the URL looked up using its exact declared path. No regex-based filename substitution or punctuation normalization is involved.

Evidence: `tests/browser/issues/915.test.ts`, `image-identity.ts`, and `tests/e2e/issue-915.spec.ts`. The archived case passes in native Chromium and Chromium/Firefox/WebKit end-to-end runs. Original image bytes are generated under the project fixture convention, without copying an upstream book or opaque PNG payload.

Full validation: `pnpm check` passed with 777 unit/native-browser tests, three built-package consumer tests, and 270 cross-engine/mobile-emulation end-to-end tests.
