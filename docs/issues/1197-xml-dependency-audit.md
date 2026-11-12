# #1197: historical XML dependency audit report

Source: [upstream #1197](https://github.com/futurepress/epub.js/issues/1197), queried in the 2026-11-12 inventory (no discussion comments). The report links historical npm advisory 1650 without supplying the affected dependency lockfile or a reproduction. Feature: F36.

Status: **Current production dependency/audit baseline verified; original advisory mapping remains pending**. No implementation or dependency update was necessary in this pass, and no upstream closure is claimed.

## Current evidence

On 2026-11-12, `pnpm audit --prod --json` reported zero informational, low, moderate, high or critical advisories across five production dependencies. `pnpm list --prod --depth Infinity --json` confirmed the resolved production graph:

| Package          | Resolved version |
| ---------------- | ---------------- |
| `@xmldom/xmldom` | `0.9.12`         |
| `fflate`         | `0.8.3`          |
| `css-tree`       | `3.2.1`          |
| `mdn-data`       | `2.27.1`         |
| `source-map-js`  | `1.2.2`          |

The unchanged upstream reference currently declares `@xmldom/xmldom: ^0.7.5`; that is not proof of the dependency tree at the time of the historical report. Folio pins its own scoped dependency. The [maintainer security policy](https://github.com/xmldom/xmldom/security/policy) distinguishes the maintained scoped package from the deprecated unscoped `xmldom` package, which is absent from Folio's production graph. This does not identify advisory 1650's exact affected range from the sparse issue alone.

Folio's shared XML boundary also limits document size, rejects custom entities/nonempty DTD subsets before parsing, keeps package/container DTD rejection, and makes parser warnings/errors fatal. The inert empty XHTML exception is separately tested and documented under [#1420](./1420-empty-doctype.md).

Validation: 28 existing unit/native-browser security tests passed. The same source/dependency baseline passed the preceding full `pnpm check` with 776 unit/native-browser tests and 267 end-to-end tests. Registry audit results are a dated known-advisory snapshot, not a complete XML security assessment or a reason to mark the historical report reproduced.
