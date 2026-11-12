# Local lifecycle regressions

Verified on 2026-11-12 for F35. These are local reproductions, not inspected upstream issue IDs or claims of upstream closure.

| Reproduction                                                           | Expected behavior                                                        | Evidence                                                                     | Status       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------ |
| A custom fetch ignores cancellation, or a response body never finishes | Request consumers reject promptly; owned streams are cancelled           | `tests/unit/lifecycle/cancellation.test.ts`                                  | Verified fix |
| A cover/resource producer ignores destruction                          | Pending consumers reject; no URL survives destruction                    | `tests/unit/lifecycle/cancellation.test.ts`                                  | Verified fix |
| Two consumers share asset reads and one cancels                        | Cancel only the consumer; retain shared book-owned I/O                   | `tests/unit/lifecycle/producers.test.ts`, `cancellation.test.ts`             | Verified fix |
| A host view destructor throws before core cleanup                      | Remove every frame and continue other cleanup phases                     | `tests/browser/lifecycle/cleanup.test.ts`, `tests/e2e/lifecycle.spec.ts`     | Verified fix |
| Asynchronous close cancels a pending render hook                       | Wait for subsequently queued unload hooks before closing resource access | `tests/browser/lifecycle/async-close.test.ts`, `tests/e2e/lifecycle.spec.ts` | Verified fix |
| A relocation listener destroys its reader during initial display       | Stop later listeners and reject the display                              | `tests/browser/lifecycle/dispatch.test.ts`                                   | Verified fix |

Each listed regression failed against its preceding implementation before the fix. Additional tests exercise task ownership, retry, concurrent CSS cycles, public states, cleanup error aggregation, and idempotence.
