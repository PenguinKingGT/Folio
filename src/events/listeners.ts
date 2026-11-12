/** Keep typed subscriptions independently owned and safe to mutate during dispatch. */

/** Snapshot subscribers so registration changes affect subsequent notifications. */
export class Listeners<T> {
  private readonly listeners = new Set<(value: T) => void>();
  private generation = 0;
  /** Return an idempotent unsubscribe handle. */
  subscribe(listener: (value: T) => void): () => void {
    const generation = this.generation;
    this.listeners.add(listener);
    return () => {
      if (generation === this.generation) {
        this.listeners.delete(listener);
      }
    };
  }
  /** Publish to the listeners registered at dispatch start. */
  emit(value: T): void {
    const generation = this.generation;
    const listeners = Array.from(this.listeners);
    for (const listener of listeners) {
      if (generation !== this.generation) {
        break;
      }
      listener(value);
    }
  }
  /** Release all callbacks when the owning reader is destroyed. */
  clear(): void {
    this.generation++;
    this.listeners.clear();
  }
}
