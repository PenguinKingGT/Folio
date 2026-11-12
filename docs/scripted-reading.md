# Explicit scripted reading (F34)

```ts
const reader = book.renderScriptedTo(container, {
  scripts: true,
  popups: false,
  inject: ['window.hostProvidedLabel = "Original integration";'],
});
reader.on('message', (data) => receivePublicationData(data));
reader.on('error', (error) => showPublicationError(error));
await reader.display(0);
```

`scripts: true` is required before frame allocation or chapter I/O. Truthy strings, absent permission, and legacy metadata do not authorize execution. `popups: true` separately permits sandboxed popup creation; the default blocks it. Browser popup policy still applies, and blocked `window.open()` can return null or throw. Popups inherit sandbox restrictions; no sandbox escape or top-navigation permission is granted.

This is a separate `ScriptedReader`, with `sandbox="allow-scripts"` and optional `allow-popups`. It has an opaque origin and never receives `allow-same-origin`. Publisher scripts can update their own document but cannot access the application's DOM or remove the owning frame's sandbox. Native camera/microphone/geolocation delegation is denied. The iframe is measurable while hidden during initialization, including in Firefox, then revealed after its current bootstrap signals readiness.

## Supported API and execution

- `display()` accepts chapter indexes, IDs, hrefs and anchors; `next()`/`prev()` move between linear chapters and return null at boundaries. `ScriptedTarget` describes these inputs. Native CFI and percentage seeking reject explicitly.
- `frame`, `currentSection`, `lastError`, and typed `on`/`off`/`once` events (`displayed`, `message`, `error`, `destroyed`) are available. `getContents()` returns null: host-native Range, pagination, relocation, themes, selection, annotations, and native view hooks depend on document access and belong to the passive readers.
- Headless section content/serialization hooks still run. Book-owned scripted readers are destroyed with their book; direct `new ScriptedReader()` callers own their cleanup. New displays cancel old preparation/handshake waits, and repeated destruction is safe.
- Classic XHTML inline/external scripts, inline event handlers, local stylesheets/imports, images, fonts and media use embedded data URLs. Script and style text is encoded rather than inserted into HTML raw-text contexts. Inline script ordering is preserved when converting to an external data source. Non-executable script types are removed; module graphs are explicitly unsupported.
- `inject` contains at most 16 literal JavaScript strings, each up to 256 KiB. They execute in order after the bootstrap and before publisher scripts. They execute inside the same opaque sandbox and receive no host DOM privileges. `readingSystem: { name, version }` overrides the default Folio/library-version identity; each string requires 1–128 units.

The CSP allows embedded classic scripts and styles and denies connect, nested frames/objects, forms, and base URLs. Publisher meta policies, refresh, base, embedded frames/objects, and forms are removed before asset resolution. Remote assets/scripts reject even if the book allows other remote resources; that policy does not implicitly grant executable remote content. Dynamic module graphs, eval-based execution, arbitrary network fetch, workers, nested scripted frames, and privileged host RPC are not provided. A script can navigate its own opaque browsing context, so this mode does not claim to prohibit every possible outbound navigation.

`loadTimeoutMs` bounds readiness (15 seconds by default). `maxResourceBytes` bounds local resources per display (32 MiB default, integer from 1 through 128 MiB); embedded URL expansion is capped at twice that value. A display permits at most 256 distinct resources, 16 CSS dependency levels, and 1 MiB per stylesheet. Cycles, malformed media types, byte overruns and missing resources reject. Data URLs require no extra object-URL revocation; shared book resources retain their normal lifetime.

## Reading-system identity and messages

The bootstrap installs a frozen, readonly `navigator.epubReadingSystem` before publisher execution. It retains legacy `name`, `version`, and `layoutStyle: 'scrolling'` fields. `hasFeature()` recognizes DOM manipulation, layout changes, mouse/keyboard events, touch availability, and spine-level execution within this chapter. Standard features are versionless and unknown names return undefined, following the current [EPUB reading-system interface](https://www.w3.org/TR/epub-rs-34/#app-epubReadingSystem). This compatibility surface is not a claim of full EPUB reading-system conformance or cross-chapter script access.

Publisher/injected scripts can send application data through `window.folio.postMessage(jsonValue)`. Messages are limited to 64 KiB of JSON. The host validates the current frame's source window, opaque origin, session token, message type, payload size and JSON syntax; stale, malformed and unrelated messages are ignored. Publication data remains `unknown` to host TypeScript callers and never causes privileged actions automatically.

Script/resource exceptions and unhandled promise rejections become bounded error notifications and `lastError`; a readable document can still complete display. Preparation/handshake failures reject `display()`. Expected cancellation is not an operational error. Error details can be generic under browser cross-origin reporting rules. Long-running or destructive publisher code still executes as JavaScript in its allowed browser context; execution cannot supply the native passive-reader guarantees.

Tests cover opt-in validation, ordered injection, actual classic/CSS/SVG resources, readonly identity, protocol validation, parent DOM denial, resource limits, publisher failures, navigation, readiness timeout, cancellation, cleanup, and real allowed/blocked popup gestures in Chromium/Firefox/WebKit. A separate native consumer test executes the built package to verify serialized bootstrap code after bundling.
