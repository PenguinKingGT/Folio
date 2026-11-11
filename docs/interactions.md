# Content interactions (F25)

```ts
const reader = book.renderTo('#reader');
reader.interactions.onSelection((selection) => {
  console.log(selection?.text, selection?.cfi, selection?.range);
});
reader.interactions.onLink((link) => {
  if (link.kind === 'external') {
    console.log('External link requested:', link.resolvedHref);
  }
});
await reader.display();

// Host toolbars can capture selection or activate a passive chapter link explicitly.
const selection = reader.interactions.captureSelection();
const link = reader.interactions.getLinks()[0];
if (link) {
  await reader.interactions.activate(link.href, link.section.index);
}
```

Bounded and continuous readers expose independent `interactions` controllers. `onSelection`, `onInput`, `onLink`, and `onError` return idempotent unsubscribe functions. Callbacks run synchronously and should not throw. Chapter replacement, view trimming, and reader/book destruction release listeners, mutation observers, deferred selection work, and cached selection references.

`captureSelection(document?)` captures the first non-collapsed text Range in a visible owned document. An explicit document may also identify a preloaded/facing page. The snapshot includes its section, text, complete CFI, and a cloned native Range; editing the clone never edits the browser selection. Collapsed, textless, and head-only ranges return null. `selection` retains the latest snapshot. Changed native selections emit once per host animation frame; clearing or unloading a selected chapter emits null. Foreign or released documents reject.

`onInput` forwards keyboard down/up and pointer down/up/move as discriminated `ContentInput` values containing the native event and origin section. Synchronous `event.preventDefault()` remains available, including cancellation before touch navigation or keyboard link activation. Mouse/pen/touch types and modifier keys stay on the native event.

Hyperlinks become passive before iframe insertion: original targets move to `data-folio-href`, while native `href`/SVG `xlink:href` attributes are removed. Authored roles and tab order remain; otherwise links receive `role="link"` and `tabindex="0"`. This prevents an iframe from navigating itself when event callbacks are unavailable. CSS that relies on `:link` or `[href]` should use `[data-folio-href]` for reading links instead. Dynamically inserted/edited links are neutralized by a mutation observer and by link inventory refresh.

`getLinks(document?)` returns original URIs, labels, origin sections, and native anchor elements for a host navigation panel. `activate(href, originIndex?)` resolves relative to that chapter, including fragment-only targets in preloaded chapters. It emits a `LinkActivation` before automatically displaying an internal spine target. `link.preventDefault()` cancels that display. Plain primary clicks and keyboard Enter use the same path. Modified clicks notify the host without replacing the reading position.

HTTP(S), protocol-relative, mailto, and tel links emit `external` notifications; local non-spine targets emit `resource`. The core opens no windows and performs no outbound navigation or asset reads for these notifications. They require no remote-resource fetching permission. Executable/unsupported schemes, traversal, invalid CFIs, and unknown origins reject. Safe handling of a notification belongs to the host application.

`whenIdle()` follows the latest link activation and runnable selection work. `lastError` and `onError` report background failures; explicit activation promises also reject. A new activation clears the retained error. Newer internal links supersede older displays, and destruction cancels pending consumers without waiting for an uncooperative producer.

The tested passive WebKit engine suppresses native DOM event callbacks inside script-disabled sandboxed iframes. Explicit `captureSelection()` and `activate()` work across Chromium, Firefox, and WebKit and support accessible host controls under the same isolation policy. Native selection/input/click forwarding requires an engine that delivers those callbacks. Hyperlinks stay passive in every engine; this feature never enables publication scripts.
