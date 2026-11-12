/** Typed synchronous event subscriptions with deterministic reentrancy and terminal cleanup. */

/** Each event carries one typed payload; listeners should complete synchronously without throwing. */
export type EventListener<T> = (value: T) => void;

/** Owners publish through protected methods while callers receive only subscription operations. */
export class EventEmitter<Events extends object> {
  private listeners: {
    [Key in keyof Events]?: Map<EventListener<Events[Key]>, { once: boolean }>;
  } = {};
  private closed = false;
  private readonly clearers = new Set<() => void>();

  /** Subscribe once per function/event pair and return an idempotent unsubscribe handle. */
  on<Key extends keyof Events>(event: Key, listener: EventListener<Events[Key]>): () => void {
    return this.register(event, listener, false);
  }

  /** Remove a callback by its original identity, including callbacks registered with once(). */
  off<Key extends keyof Events>(event: Key, listener: EventListener<Events[Key]>): void {
    this.listeners[event]?.delete(listener);
  }

  /** Remove the subscription before invocation so recursive dispatch cannot invoke it twice. */
  once<Key extends keyof Events>(event: Key, listener: EventListener<Events[Key]>): () => void {
    return this.register(event, listener, true);
  }

  /** Snapshot registration order; additions wait for the next dispatch and removals take effect immediately. */
  protected emit<Key extends keyof Events>(event: Key, value: Events[Key]): void {
    const bucket = this.listeners[event];
    if (this.closed || bucket === undefined) {
      return;
    }
    for (const [listener, registration] of Array.from(bucket)) {
      if (this.closed) {
        break;
      }
      if (bucket.get(listener) !== registration) {
        continue;
      }
      if (registration.once) {
        bucket.delete(listener);
      }
      listener(value);
    }
  }

  /** Publish the final lifecycle event while guaranteeing cleanup even if a subscriber throws. */
  protected finishEvents<Key extends keyof Events>(event: Key, value: Events[Key]): void {
    try {
      this.emit(event, value);
    } finally {
      this.closed = true;
      for (const clear of this.clearers) {
        clear();
      }
      this.clearers.clear();
      this.listeners = {};
    }
  }

  /** Validate runtime callbacks and retain the original callback identity without unsafe casts. */
  private register<Key extends keyof Events>(
    event: Key,
    listener: EventListener<Events[Key]>,
    once: boolean,
  ): () => void {
    if (this.closed) {
      throw new Error('Event owner has been destroyed.');
    }
    if (typeof listener !== 'function') {
      throw new TypeError('Event listeners must be functions.');
    }
    let bucket = this.listeners[event];
    if (bucket === undefined) {
      const owned = new Map<EventListener<Events[Key]>, { once: boolean }>();
      bucket = owned;
      this.listeners[event] = owned;
      this.clearers.add(() => owned.clear());
    }
    let registration = bucket.get(listener);
    if (registration === undefined) {
      registration = { once };
      bucket.set(listener, registration);
    }
    return () => {
      if (bucket.get(listener) === registration) {
        bucket.delete(listener);
      }
    };
  }
}
