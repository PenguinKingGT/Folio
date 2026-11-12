/** Manual extension gates make asynchronous lifecycle tests deterministic without timers. */

/** Expose the producer completion separately from its consumer promise. */
export function gate(): { promise: Promise<void>; release: () => void } {
  let deliver: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    deliver = resolve;
  });
  return { promise, release: () => deliver?.() };
}
