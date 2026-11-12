/** Cancellation is expected lifecycle control rather than a new operational error notification. */

/** Inspect the standard error name without relying on a same-realm DOMException constructor. */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

/** Complete every owned cleanup even when a lifecycle subscriber throws, then surface all failures. */
export function disposeAll(operations: readonly (() => void)[]): void {
  const errors: unknown[] = [];
  for (const operation of operations) {
    try {
      operation();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'One or more lifecycle cleanup operations failed.');
  }
}
