/** Per-consumer cancellation must not abort shared resource producers. */

/** Race a shared operation with one caller's signal, removing listeners on every outcome. */
export function withAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) {
    return operation;
  }
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    /** Reject only this consumer; the shared producer owns its own controller. */
    const abort = (): void => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}
