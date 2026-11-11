/** Keep continuous-reader subscriptions independently owned and safe to mutate during dispatch. */

/** Snapshot subscribers so registration changes affect subsequent notifications. */
export class Listeners<T> {
  private readonly listeners = new Set<(value: T) => void>();
  /** Return an idempotent unsubscribe handle. */
  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** Publish to the listeners registered at dispatch start. */
  emit(value: T): void {
    const listeners = Array.from(this.listeners);
    for (const listener of listeners) {
      listener(value);
    }
  }
  /** Release all callbacks when the owning reader is destroyed. */
  clear(): void {
    this.listeners.clear();
  }
}
