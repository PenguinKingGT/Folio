/** Cancellation classification and exhaustive owner cleanup preserve errors across every lifecycle phase. */

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

/** Await every lifecycle phase and retain earlier failures when a later unload or final cleanup also fails. */
export async function disposeAsync(
  operations: readonly (() => void | Promise<void>)[],
): Promise<void> {
  const errors: unknown[] = [];
  for (const operation of operations) {
    try {
      await operation();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'One or more asynchronous cleanup phases failed.');
  }
}

/** Preserve the initiating operation's failure even if releasing its staged resources also throws. */
export function errorAfterCleanup(error: unknown, cleanup: () => void): unknown {
  try {
    cleanup();
  } catch (failure) {
    return new AggregateError([error, failure], 'Operation and resource cleanup both failed.', {
      cause: error,
    });
  }
  return error;
}
