# #1420: compact empty XHTML DOCTYPE subsets

Source: [upstream #1420](https://github.com/futurepress/epub.js/issues/1420), queried on 2026-11-12 (no discussion comments). Features: F04/F12/F36.

Status: **Locally verified inert-empty-subset compatibility fix**. The initial inventory classified every internal subset as a deliberate exclusion. This review narrows that decision for an inert empty bare `html` declaration; entity-bearing and other nonempty subsets remain excluded. No upstream closure is claimed.

## Compatibility decision

[XML 1.0 section 2.8](https://www.w3.org/TR/xml/#sec-prolog-dtd) permits an empty internal subset and optional whitespace before it. Folio's own pre-parser guard rejected `<!DOCTYPE html[]>` before either parser ran, independently of the browser regression described upstream.

Before headless or native XHTML parsing, Folio now replaces a bare `html` declaration containing only an empty/whitespace internal subset with `<!DOCTYPE html>`. The scanner only considers the document prolog, skipping XML whitespace, comments and processing instructions. It does not replace text inside body content, CDATA or comments. One leading decoded byte-order mark is consumed consistently at the shared input boundary.

The exception does not permit custom entities, parameter entities, element/attribute declarations, nonempty subsets, other root names, or external identifiers with internal subsets. Package/container XML still rejects all DOCTYPE declarations. Original source-size bounds apply before normalization. Duplicate/malformed declarations still reject through the shared guard or strict parser. Native passive and explicit scripted sandbox permissions are unchanged.

This is a limited compatibility correction, not adoption of the report's broader entity-bearing normalization suggestion.

## Evidence

Four acceptance reproductions failed before the fix: three headless empty-subset forms and direct native preparation. Tests now cover compact/spaced/whitespace subsets, XML declarations, comments, processing instructions, decoded BOMs, malformed prologs, duplicate declarations, body literals, and retained rejection of active/nonempty DTD constructs.

- `tests/unit/xml/empty-doctype.test.ts`
- `tests/unit/xml/doctype-prolog.test.ts`
- `tests/browser/issues/1420.test.ts`
- `tests/e2e/issue-1420.spec.ts`: complete books in passive and explicitly scripted readers, across Chromium, Firefox and WebKit, including isolation assertions.

The browser test receives normalized source, so compatibility does not depend on whether its installed native XML parser has the upstream whitespace regression. Unavailable browser versions mentioned in the report were not installed or asserted as tested.

Full validation: `pnpm check` passed with 776 unit/native-browser tests, three built-package consumer tests, and 267 cross-engine/mobile-emulation end-to-end tests.
