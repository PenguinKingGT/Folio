# Inline view compatibility (F33)

Built-in readers support `view: 'iframe'` and the absent/default selector. `view: 'inline'`, unknown strings, null, and legacy constructor selectors reject with a `TypeError` before chapter reads or custom view-factory invocation. Invalid construction removes its temporary surface; continuous mode validates before creating its scrollport. This avoids silently accepting a legacy option with different document semantics.

```ts
const reader = book.renderTo(container, { view: 'iframe' });
await reader.display();
```

Upstream's inline view inserts publication markup into host-document elements. Folio's native readers depend on a separate document for standards-mode layout, canonical body CFIs, scoped publisher styles, CSP, and the passive sandbox. Inserting the same markup directly into the application would change these contracts. A ShadowRoot alone would not supply the same execution, navigation, or resource policy boundary.

Direct publisher HTML insertion into the host document is **out of scope for built-in views**. This is the compatibility decision tracked by F33, rather than a claim of an implemented inline reader. Built-in views keep `sandbox="allow-same-origin"` with scripts disabled. The `createView` extension remains an `IframeView` subclass/factory contract; it cannot choose an inline mode or return a host `div` instead.

Trusted applications can use [Book.renderWith()](./extensions.md) for a custom `ManagedReader`, including their own non-iframe rendering. Such managers own their document/DOM mapping, styles, resource restrictions, interaction model, and cleanup. The built-in reader guarantees do not automatically apply to unrelated custom managers. `Section.render()` is headless serialization, not a safe host-DOM insertion API.

Unit tests cover accepted/rejected selectors. Native tests verify that invalid inline mode performs no chapter I/O or factory work, leaves the host empty, and permits a subsequent valid reader. Chromium/Firefox/WebKit tests verify actual publisher style/document isolation and passive script behavior after the explicit compatibility rejection.
