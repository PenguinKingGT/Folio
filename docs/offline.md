# Persistent offline reading (F30)

```ts
import { Book, OfflineStore } from 'folio-epub';

const offline = new OfflineStore('reader-account-library');
offline.on('offline', () => showConnectivity(false));
offline.on('online', () => showConnectivity(true));

const book = await Book.open('/books/original.epub', { offline });
// For extracted directories, preload unvisited chapters and declared assets.
await book.prefetchResources();
await book.destroyAsync();

// Reuse the namespace in a later session, including when the browser is offline.
const restored = await Book.open('/books/original.epub', { offline });
restored.destroy();
offline.destroy();
```

`OfflineStore(name, options?)` owns a native CacheStorage namespace named `folio-offline-v1:<name>`. Names accept 1–128 ASCII letters, digits, dots, underscores, and hyphens. Persistence requires CacheStorage and Web Crypto in a secure browser context. `options.storage` can provide an application-owned CacheStorage implementation. Constructing a store performs no network/cache I/O; headless books remain usable without constructing one.

Pass the store through `Book.open(..., { offline })`. The existing Fetch boundary preserves custom transports, headers, credentials, and cancellation. Online GET responses are persisted before delivery. Offline requests use only persisted data and reject with `OfflineMissError` on a miss. Online transport `TypeError` failures can fall back to an existing response; HTTP errors and other host transport errors remain visible. Failed responses, HTTP 206, `Vary: *`, and `Cache-Control: no-store` are not persisted. No failure is silently treated as an empty resource.

Cache identities include the URL without its fragment, request mode, credentials mode, and normalized headers. SHA-256 keys avoid persisting raw authorization header values as entry names. Select namespaces per account/library and clear them when their content should no longer be available; browser-added cookies are not accessible as request headers and account changes require host namespace management. CacheStorage contains the resource bodies and response headers themselves. Browser quota/eviction rules apply; persistence/storage failures reject normally.

Archive URLs persist the complete downloaded EPUB. Directory and OPF sources persist requested container/package/navigation/chapter/asset bytes. `await book.prefetchResources(signal?)` sequentially reads every declared manifest item through the normal byte provider and returns the number read. It preserves resource policy and aborts on missing assets, policy errors, or cancellation. Already persisted items remain available after a partial prefetch failure. It does not execute scripts or crawl undeclared references. Binary/Base64 inputs already belong to the caller and do not acquire a persistent URL identity.

Default connectivity follows the browser's initial `navigator.onLine` and native `online`/`offline` events. This is a retrieval policy, not a guarantee of server reachability. `setOnline(boolean)` explicitly changes that policy; native events continue to update it unless `observeConnectivity: false` was supplied. `online: boolean` overrides the initial value. Repeated identical states do not emit duplicate events. Stores expose typed `on`, `off`, and `once` for `online`, `offline`, `error`, and `destroyed`; error events supplement rejected retrieval promises.

`store.wrap(fetch)` returns a standard Fetch wrapper for host use. `store.retrieve(input, init?)` reads an exact persisted request without a network attempt or state change; its headers/credentials/mode must match those used to store the response. Only GET requests and HTTP(S)/Blob URLs are supported. A permitted remote publication resource still requires the book's existing `allowRemote` policy.

`await store.clear()` cancels old-generation consumers and deletes only that namespace. New requests wait for deletion. Instances reopen Cache handles for each operation so another instance's deletion cannot leave a stale retained handle. Retry `clear()` to recover after a storage deletion failure. `destroy()` removes connectivity listeners, cancels pending waits even if a custom transport ignores its signal, and closes subscriptions. It preserves persisted data and is safe to repeat. Call `clear()` before destroying when deletion is required.

The host owns stores; destroying a Book does not destroy a shared store. Every reopened book independently owns its resource Blob URLs and revokes them on destruction. The persistent cache stores responses, not Blob URLs. Tests verify byte identity, partitioning, fallback policy, directives, storage errors, cancellation, shared namespaces, URL revocation, and real Chromium/Firefox/WebKit offline/online transitions for archive and directory books.
