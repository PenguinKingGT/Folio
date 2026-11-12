/** Wait for the intended srcdoc document, ignoring initial/stale iframe load events. */

import { restoreStyles } from './restore-styles';

/** Resolve only when the document token matches; every terminal path removes listeners and timers. */
export function loadFrame(
  frame: HTMLIFrameElement,
  source: string,
  token: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<Document> {
  signal.throwIfAborted();
  return new Promise<Document>((resolve, reject) => {
    /** Release all operation-owned browser subscriptions. */
    const cleanup = (): void => {
      frame.removeEventListener('load', loaded);
      frame.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
      clearTimeout(timer);
    };
    /** Reject once with an explicit network, cancellation, or timeout error. */
    const fail = (error: unknown): void => {
      cleanup();
      reject(error);
    };
    /** Initial about:blank and superseded documents must not complete this operation. */
    const loaded = (): void => {
      const document = frame.contentDocument;
      if (document?.documentElement?.getAttribute('data-folio-document') === token) {
        restoreStyles(document);
        cleanup();
        resolve(document);
      }
    };
    const failed = (): void => fail(new Error('Chapter iframe failed to load.'));
    const aborted = (): void => fail(signal.reason);
    const timer = setTimeout(() => fail(new Error('Chapter iframe load timed out.')), timeoutMs);
    frame.addEventListener('load', loaded);
    frame.addEventListener('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
    frame.srcdoc = source;
  });
}
