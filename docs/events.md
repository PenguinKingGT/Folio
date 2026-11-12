# Typed events (F28)

Opened books, bounded readers, continuous readers, and location indexes expose `on(event, listener)`, `off(event, listener)`, and `once(event, listener)`. Event names and their single payload are inferred from the owner. Both registration methods return an idempotent unsubscribe function. Existing `onRelocated()`, interaction subscriptions, annotation subscriptions, and continuous `onError()` remain available.

```ts
const unsubscribe = reader.on('selected', (selection) => {
  if (selection) {
    showSelection(selection.text, selection.cfi);
  }
});
reader.once('displayed', (section) => announceChapter(section.href));
reader.on('link', (link) => {
  link.preventDefault();
  openLinkPanel(link.resolvedHref);
});
unsubscribe();
```

| Owner        | Events and payloads                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Book`       | `resourceLoaded`: frozen `{ href, from, bytes }` for successful `bytes()` reads, including chapter reads; `readerCreated`: the newly owned reader; `error`: byte-read failure; `destroyed`: `undefined`.                                                                                                                                                                                                       |
| Both readers | `displayed`: section after successful explicit display, including same-section seeks; `relocated`: visible location; `selected`: selection snapshot or `null`; `input`: native keyboard/pointer input; `link`: preventable activation; `annotationClick`: annotation and host input; `error`: display/interaction/annotation failure (continuous background failures also included); `destroyed`: `undefined`. |
| `Locations`  | `generated`: committed entries; `restored`: committed loaded entries; `changed`: frozen `{ index, cfi, percentage }` when `setCurrent()` changes the sample; `error`: generation failure; `destroyed`: `undefined`.                                                                                                                                                                                            |

`BookEventMap`, `ReaderEventMap`, `LocationsEventMap`, and `EventListener<T>` are exported types. `readerCreated` carries the `ManagedReader` contract, including host factories registered through [extensions](./extensions.md). Opening failures reject `Book.open()` before a book exists. Other synchronous validation failures remain direct exceptions unless an operation listed above reports them. Standard `AbortError` cancellation is expected control flow and does not emit an operational error. Error notifications supplement rejected operation promises; listeners should still handle those promises.

Delivery is synchronous in registration order. Registering the same function/event pair again retains its first subscription mode; distinct functions remain independent. New listeners wait for the next dispatch. Removing or replacing a listener before its turn suppresses that old registration. `once()` unregisters before invocation, including recursive dispatch. `off()` accepts the original callback for both subscription modes. An old unsubscribe handle cannot remove a newer replacement registration.

Listeners should complete synchronously without throwing; exceptions propagate to the dispatch caller, and returned promises are not awaited. During destruction, owners release subscriptions even if a final listener throws. Book destruction completes cleanup of every owned reader and resource before throwing an `AggregateError` for cleanup failures. Repeated destruction is safe, registration after destruction throws, and `off()`/unsubscribe remain safe. Pending work cannot deliver new events after closure.

Selection and native input retain the passive iframe limitations described in [content interactions](./interactions.md). In particular, WebKit can suppress callbacks inside script-disabled frames. Explicit selection capture, explicit link activation, and host annotation controls remain usable; this event API does not enable publication scripts. Tests cover headless owners, native DOM forwarding, recursive dispatch, cancellation, cleanup failures, and both readers in Chromium, Firefox, and WebKit.

Passive scrolling has a host-offset fallback when child-document callbacks are suppressed, so relocated positions and annotation geometry can follow native wheel movement. This does not change native input/selection forwarding limitations. See [#1164](./issues/1164-native-annotation-scroll.md).
