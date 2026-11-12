# Local untrusted-input regressions

Verified on 2026-11-12 for F36. No upstream issue IDs were assigned or claimed closed.

| Reproduction                                                        | Before                                                       | Verified behavior                                                                | Evidence                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Response declares one byte but emits more than the configured limit | All bytes accepted                                           | Decoded bytes are counted; overrun rejects and cancels the stream                | `tests/unit/security/response.test.ts`                                   |
| Response declares a size over the configured limit                  | Body accepted                                                | Reject before accumulation; cancel owned stream                                  | `tests/unit/security/response.test.ts`                                   |
| XHTML style contains a child selector and escaped/end-tag strings   | Selector became XML entity text in the HTML raw-text element | Preserve computed CSS and literal text without creating script elements          | `tests/browser/security/styles.test.ts`, `tests/e2e/security.spec.ts`    |
| Explicitly authorized script creates a data-URL Worker              | Worker executed in Chromium                                  | Explicit `worker-src 'none'` blocks actual worker execution in all three engines | `tests/browser/security/execution.test.ts`, `tests/e2e/security.spec.ts` |

The above regressions failed before their fixes. Additional tests cover decoded gzip limits, zero-length chunk exhaustion, configuration validation, failed-request retry, malformed network UTF-8, native DTD rejection, stylesheet byte/depth limits, foreign script namespaces, and already-decoded SVG style text. Existing archive/path/CSP tests remain part of the full check.
