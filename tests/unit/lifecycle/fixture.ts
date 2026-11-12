/** Deterministic producer gates expose cancellation independently of transport completion. */

/** A typed producer can finish after its consumers have already cancelled. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let deliver: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    deliver = resolve;
  });
  return { promise, resolve: (value) => deliver?.(value) };
}

/** Observe settlement without producing an unhandled rejection while a producer is intentionally held. */
export function outcome(operation: Promise<unknown>): { state: () => string; done: Promise<void> } {
  let state = 'pending';
  const done = operation.then(
    () => {
      state = 'resolved';
    },
    () => {
      state = 'rejected';
    },
  );
  return { state: () => state, done };
}

/** Advancing one event-loop turn drains cancellation microtasks without a timer-based settling assumption. */
export function nextTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
