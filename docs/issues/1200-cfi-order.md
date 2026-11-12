# #1200: range comparison and invalid CFI input

Source: [upstream #1200](https://github.com/futurepress/epub.js/issues/1200), queried on 2026-11-12. Features: F10/F11.

Status: **Reported inputs rejected; valid native order verified**. No comparator modification was necessary. Sorting by path depth instead of structural step order would introduce incorrect results.

The reported second range starts at `/2/1:4` but ends at `/1:21` beneath the same paragraph. Its end structurally precedes its start; Folio rejects the reversed range during parsing. The reported first range uses `/1` for paragraph text although the supplied paragraph begins with a bold element: following text belongs to a later logical slot. An authored equivalent paragraph confirms that the supplied path cannot resolve there.

A separate valid native range spans from inside a bold element into following text; another lies later in that following text. Generating CFIs from these actual ranges preserves native start-order comparison in both directions, and both generated CFIs resolve to the exact original selected text.

Evidence: `tests/browser/issues/1200.test.ts` contains three passing native DOM regressions. This rejects the malformed input and verifies the intended ordering condition; it does not claim that every old epub.js CFI can be silently repaired or that the upstream issue has been closed.

Validation: full `pnpm check` passed with 715 unit/native-browser tests, three built-package consumer tests, and 238 cross-engine/mobile end-to-end tests.
