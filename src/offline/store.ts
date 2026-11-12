/** Persist successful publication responses and serve exact request identities without network access when offline. */
import { EventEmitter } from '../events/emitter';
import { isAbortError } from '../async/lifecycle';
import { withAbort } from '../async/cancellation';
import { OfflineCache } from './cache';
import { offlineKey } from './key';
import { observeConnectivity } from './connectivity';
import type { OfflineOptions, OfflineEventMap } from './types';

/** Offline misses stay distinguishable from network HTTP failures and storage failures. */
export class OfflineMissError extends Error {
  /** Preserve the requested resource address without exposing authentication header values. */
  constructor(readonly url: string) {
    super(`Resource is unavailable offline: ${url}`);
    this.name = 'OfflineMissError';
  }
}

/** A store is shared explicitly by callers and outlives individual Book instances. */
export class OfflineStore extends EventEmitter<OfflineEventMap> {
  private readonly cache: OfflineCache;
  private readonly lifetime = new AbortController();
  private readonly stopObserving: () => void;
  private connected: boolean;

  /** Open a named persistent namespace lazily; constructing a store performs no network or cache reads. */
  constructor(
    readonly name: string,
    options: OfflineOptions = {},
  ) {
    super();
    if (typeof name !== 'string' || !/^[\w.-]{1,128}$/.test(name)) {
      throw new TypeError(
        'Offline store names require 1–128 letters, digits, dots, underscores, or hyphens.',
      );
    }
    const storage = options.storage ?? globalThis.caches;
    if (storage === undefined) {
      throw new Error(
        'Offline persistence requires CacheStorage in a secure browser context or explicit storage.',
      );
    }
    for (const flag of [options.online, options.observeConnectivity]) {
      if (flag !== undefined && typeof flag !== 'boolean') {
        throw new TypeError('Offline connectivity settings must be booleans.');
      }
    }
    this.cache = new OfflineCache(storage, `folio-offline-v1:${name}`);
    this.connected =
      options.online ?? (typeof navigator === 'undefined' || (navigator.onLine ?? true));
    this.stopObserving =
      options.observeConnectivity === false
        ? () => {}
        : observeConnectivity((online) => this.setOnline(online));
  }

  /** Connectivity is a retrieval policy, not proof that any remote server is reachable. */
  get online(): boolean {
    return this.connected;
  }

  /** Update host-controlled connectivity and emit only actual state transitions. */
  setOnline(online: boolean): void {
    this.lifetime.signal.throwIfAborted();
    if (typeof online !== 'boolean') {
      throw new TypeError('Offline connectivity must be a boolean.');
    }
    if (online !== this.connected) {
      this.connected = online;
      if (online) {
        this.emit('online', undefined);
      } else {
        this.emit('offline', undefined);
      }
    }
  }

  /** Wrap a standard Fetch transport; request headers/credentials/signals retain their native semantics. */
  wrap(fetcher: typeof globalThis.fetch): typeof globalThis.fetch {
    this.lifetime.signal.throwIfAborted();
    if (typeof fetcher !== 'function') {
      throw new TypeError('Offline transports must implement fetch.');
    }
    return (input, init) => this.request(input, init, fetcher);
  }

  /** Retrieve an exact persisted request without making a network attempt or changing connectivity. */
  retrieve(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return this.request(input, init);
  }

  /** Cancel old-generation requests and delete this namespace; other application caches remain intact. */
  clear(): Promise<void> {
    this.lifetime.signal.throwIfAborted();
    return this.cache.clear();
  }

  /** Release connectivity subscriptions and pending consumers while leaving persistent entries available. */
  destroy(): void {
    if (!this.lifetime.signal.aborted) {
      this.lifetime.abort();
      this.stopObserving();
      this.cache.destroy();
      this.finishEvents('destroyed', undefined);
    }
  }

  /** Give cancellation priority over cache access, uncooperative network producers, and persistence waits. */
  private async request(
    input: RequestInfo | URL,
    init?: RequestInit,
    fetcher?: typeof globalThis.fetch,
  ): Promise<Response> {
    const request = new Request(input, init);
    const signal = AbortSignal.any([request.signal, this.lifetime.signal, this.cache.signal]);
    signal.throwIfAborted();
    try {
      return await withAbort(this.response(request, signal, fetcher), signal);
    } catch (error) {
      if (!isAbortError(error)) {
        this.emit('error', error);
      }
      throw error;
    }
  }

  /** Prefer fresh online responses; only transport failures can fall back to already persisted content. */
  private async response(
    request: Request,
    signal: AbortSignal,
    fetcher?: typeof globalThis.fetch,
  ): Promise<Response> {
    const key = await offlineKey(request);
    const cache = await this.cache.open(signal);
    signal.throwIfAborted();
    if (!this.connected || fetcher === undefined) {
      return this.cached(cache, key, request.url, signal);
    }
    let response: Response;
    try {
      response = await fetcher(request, { signal });
    } catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof TypeError)) {
        throw error;
      }
      const fallback = await cache.match(key);
      signal.throwIfAborted();
      if (fallback !== undefined) {
        return fallback;
      }
      throw error;
    }
    signal.throwIfAborted();
    const wildcard = response.headers
      .get('vary')
      ?.split(',')
      .some((value) => value.trim() === '*');
    const noStore = /(?:^|,)\s*no-store(?:\s|,|$)/i.test(
      response.headers.get('cache-control') ?? '',
    );
    if (response.ok && response.status !== 206 && !wildcard && !noStore) {
      await cache.put(key, response.clone());
      signal.throwIfAborted();
    }
    return response;
  }

  /** A miss is explicit and does not cause an unexpected offline network request. */
  private async cached(
    cache: Cache,
    key: string,
    url: string,
    signal: AbortSignal,
  ): Promise<Response> {
    const response = await cache.match(key);
    signal.throwIfAborted();
    if (response === undefined) {
      throw new OfflineMissError(url);
    }
    return response;
  }
}
