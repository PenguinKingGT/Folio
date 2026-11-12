# Host extensions (F29)

Extensions are trusted host code. A publication cannot register callbacks, choose factories, or enable scripts through these APIs. Hook callbacks run sequentially in registration order and may return promises. Every callback receives its context and an `AbortSignal` as its second argument.

```ts
const remove = book.hooks.content.register(async ({ document }, signal) => {
  const metadata = await loadHostMetadata({ signal });
  signal.throwIfAborted();
  document.documentElement?.setAttribute('data-host-label', metadata.label);
});

book.hooks.render.register(({ document }) => {
  const style = document.createElement('style');
  style.textContent = 'p { text-rendering: optimizeLegibility; }';
  document.head.appendChild(style);
});
remove();
```

| Hook                   | Context / timing                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `book.hooks.content`   | `{ section, document }`, with a headless XML DOM, after XHTML validation and before one successful lazy-load cache commit. Shared consumers run this pipeline once.                                                                                          |
| `book.hooks.serialize` | `{ section, document, source }`, before each `Section.render()` returns. Callbacks may replace `source`; the final value must be a string. Serialization mutations do not replace the cached DOM.                                                            |
| `book.hooks.render`    | `{ section, document, frame }`, with native DOM after passive iframe loading and before interactions, themes, measurement, or successful display. Applies to primary, facing, and continuous/preloaded views.                                                |
| `book.hooks.unload`    | The same native view context, queued once when a document is replaced/removed. Callbacks can run after detachment; asynchronous callback work is tracked by `book.hooks.whenIdle()`. Failed/cancelled render-hook contexts also receive unload notification. |

Each `AsyncHook<T>` exposes `register(callback)`, `unregister(callback)`, `clear()`, `run(context, signal?)`, and `destroy()`. Registration returns an idempotent removal handle, deduplicates identities, and permits at most 128 distinct callbacks. Runs use a stable callback snapshot: registration changes affect later runs. Errors stop that pipeline and preserve the original rejection. Content failures are not cached, so removing a failing callback permits retry. Old unsubscribe handles cannot remove newer replacement registrations.

Unloading a section cancels its outstanding content and serialization waits. New display intents cancel old native render waits. Cancelling one shared chapter consumer does not cancel other consumers or their content pipeline. Callbacks must honor their signal before delayed side effects; cancellation can stop waiting, but cannot forcibly terminate arbitrary JavaScript inside a callback.

`await book.hooks.whenIdle()` drains native unload callbacks, including new unload work queued while waiting. Non-cancellation failures are reported as an `AggregateError` and consumed by that wait. `await book.destroyAsync()` first destroys owned readers, waits for asynchronous unload work, and finally releases shared book resources even if hooks fail. Its repeated/concurrent calls share one promise. Cleanup hooks may read resources during this interval, while new reader mounts are rejected. Synchronous `book.destroy()` cancels outstanding extension waits immediately; use the asynchronous form when unload callbacks must finish.

Use content hooks for structural XML edits so headless search and rendered CFIs share the same structure. Serialization/native structural rewrites are the extension's responsibility and can invalidate previously generated CFIs. Prefer [themes](./themes.md) for resource-aware CSS/font registration, switching, and overrides. Native render hooks are suitable for host styles or DOM integration; the passive sandbox and resource policies remain in place.

## Custom managers and views

```ts
import { IframeView, Rendition } from 'folio-epub';

const reader = book.renderWith(
  (publication, target, options) => new Rendition(publication, target, options),
  container,
  {
    createView(target, options) {
      const view = new IframeView(target, options);
      view.frame.title = 'Custom chapter surface';
      return view;
    },
  },
);
```

`Book.renderWith(factory, target, options)` preserves the factory's option/result types and owns the returned `ManagedReader`. A manager implements `display(target?)`, `getContents()`, and idempotent synchronous `destroy()`. Factories may return a reader already created through the book; ownership and `readerCreated` notification are not duplicated. Custom managers must retain their own native lifecycle, isolation, and navigation guarantees. Book-level render hooks automatically apply to built-in readers; unrelated custom implementations must explicitly integrate them if needed.

Built-in reader options accept `createView(container, options)`, returning an `IframeView` or host subclass. The frame must belong to that attached container/document and retain exactly `sandbox="allow-same-origin"`. Invalid returned views are rejected and their owned frame is removed. Factories apply to bounded primary/facing pages and every continuous preload. A subclass must preserve document-load cancellation, ownership, passive policy, and cleanup contracts; host code remains responsible for modifications made after validation. A factory throwing before it returns must release resources it allocated itself.

Built-in `view` selectors accept only `iframe`; see the [inline compatibility decision](./view-compatibility.md) for non-iframe manager boundaries and explicit legacy-option rejection.

Tests cover asynchronous ordering, invalid inputs, snapshot mutation, cancellation, retry, unload failures, custom ownership, passive frame validation, fixed companions, and both reader modes in Chromium, Firefox, and WebKit. Exported context/factory types support extension authors without reaching into internal modules.
