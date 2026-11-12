/** Await trusted extension callbacks in registration order with per-run cancellation and owned lifetime. */
import { withAbort } from '../async/cancellation';

/** Extension callbacks receive a snapshot context and must honor cancellation before delayed side effects. */
export type HookCallback<Context> = (context: Context, signal: AbortSignal) => void | Promise<void>;

/** Each hook owns only callback registrations; it never starts work merely by being constructed. */
export class AsyncHook<Context> {
  private readonly callbacks = new Map<HookCallback<Context>, symbol>();
  private readonly lifetime = new AbortController();

  /** Register one callback identity, returning an idempotent removal function. */
  register(callback: HookCallback<Context>): () => void {
    this.lifetime.signal.throwIfAborted();
    if (typeof callback !== 'function') {
      throw new TypeError('Hook callbacks must be functions.');
    }
    if (!this.callbacks.has(callback) && this.callbacks.size >= 128) {
      throw new RangeError('Too many callbacks registered for one hook.');
    }
    const registration = this.callbacks.get(callback) ?? Symbol();
    this.callbacks.set(callback, registration);
    return () => {
      if (this.callbacks.get(callback) === registration) {
        this.callbacks.delete(callback);
      }
    };
  }

  /** Remove an existing callback; removal remains safe after destruction. */
  unregister(callback: HookCallback<Context>): void {
    this.callbacks.delete(callback);
  }

  /** Await a stable callback snapshot; errors stop this pipeline and propagate to its operation. */
  async run(context: Context, signal?: AbortSignal): Promise<void> {
    const combined =
      signal === undefined ? this.lifetime.signal : AbortSignal.any([signal, this.lifetime.signal]);
    combined.throwIfAborted();
    const callbacks = Array.from(this.callbacks.keys());
    for (const callback of callbacks) {
      combined.throwIfAborted();
      await withAbort(
        Promise.resolve().then(() => {
          combined.throwIfAborted();
          return callback(context, combined);
        }),
        combined,
      );
    }
    combined.throwIfAborted();
  }

  /** Remove registrations while allowing already running callback snapshots to finish. */
  clear(): void {
    this.callbacks.clear();
  }

  /** Cancel pending waits and permanently release registrations; safe to repeat. */
  destroy(): void {
    this.lifetime.abort();
    this.clear();
  }
}
