/** Serialize persistent namespace resets and invalidate in-flight consumers without retaining stale Cache handles. */
import { withAbort } from '../async/cancellation';

/** Browser CacheStorage owns persistence; the wrapper owns cancellation and a clear-operation barrier. */
export class OfflineCache {
  private generation = new AbortController();
  private barrier: Promise<void> = Promise.resolve();

  /** Bind an explicit namespace rather than sharing unrelated application caches. */
  constructor(
    private readonly storage: CacheStorage,
    private readonly name: string,
  ) {}

  /** A clear operation cancels all consumers that captured the previous generation. */
  get signal(): AbortSignal {
    return this.generation.signal;
  }

  /** Reopen the named cache for each operation so another instance's clear cannot leave a retained stale handle. */
  async open(signal: AbortSignal): Promise<Cache> {
    await withAbort(this.barrier, signal);
    signal.throwIfAborted();
    return withAbort(this.storage.open(this.name), signal);
  }

  /** Delete only this namespace and prevent new operations from racing its deletion. */
  clear(): Promise<void> {
    this.generation.abort();
    this.generation = new AbortController();
    const clear = async () => {
      await this.storage.delete(this.name);
    };
    this.barrier = this.barrier.then(clear, clear);
    return this.barrier;
  }

  /** Cancel current consumers while preserving persisted content for future store instances. */
  destroy(): void {
    this.generation.abort();
  }
}
