/** Consume native response streams with owned reader cancellation before using standard response decoders. */
import { withAbort } from '../async/cancellation';
import type { ResponseTypes } from './request';

/** Snapshot producer buffers and release the stream lock on completion, failure, or caller cancellation. */
async function responseBytes(
  response: Response,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return new Uint8Array();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  let complete = false;
  try {
    while (true) {
      signal?.throwIfAborted();
      const entry = await withAbort(reader.read(), signal);
      if (entry.done) {
        complete = true;
        break;
      }
      chunks.push(Uint8Array.from(entry.value));
      total += entry.value.length;
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } finally {
    if (!complete) {
      // Observe best-effort producer cancellation without allowing its failure/wait to replace the original error.
      void Promise.allSettled([reader.cancel(signal?.reason)]);
    }
    reader.releaseLock();
  }
}

/** Binary publication downloads avoid a second copy; other selectors retain the platform's MIME/JSON/text decoding. */
export async function readResponse<Type extends keyof ResponseTypes>(
  response: Response,
  type: Type,
  signal?: AbortSignal,
): Promise<ResponseTypes[Type]> {
  const bytes = await responseBytes(response, signal);
  signal?.throwIfAborted();
  const snapshot = () => new Response(bytes, { headers: response.headers });
  const readers: { [Key in keyof ResponseTypes]: () => Promise<ResponseTypes[Key]> } = {
    binary: () => Promise.resolve(bytes.buffer),
    text: () => snapshot().text(),
    json: () => snapshot().json(),
    blob: () => snapshot().blob(),
  };
  const result = await readers[type]();
  signal?.throwIfAborted();
  return result;
}
