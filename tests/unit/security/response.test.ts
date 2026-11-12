/** Untrusted response bounds must apply to decoded streams before accumulation or transport invocation. */
import { expect, test } from 'vitest';
import { createRequester } from '../../../src/index';

for (const type of ['text', 'binary', 'blob', 'json'] as const) {
  test(`${type} rejects oversized streaming bodies even when Content-Length understates decoded size`, async () => {
    let cancelled = false;
    let chunks = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        if (chunks++ < 2) {
          controller.enqueue(new Uint8Array(5));
        } else {
          controller.close();
        }
      },
      cancel: () => {
        cancelled = true;
      },
    });
    const request = createRequester({
      fetch: () =>
        Promise.resolve(
          new Response(stream, {
            headers: { 'content-length': '1' },
          }),
        ),
    });
    // Unknown options model a JavaScript caller before the typed bound is introduced.
    const result: unknown = Reflect.apply(request, undefined, [
      'https://original.invalid/body',
      type,
      { maxResponseBytes: 4 },
    ]);
    await expect(result).rejects.toThrow(RangeError);
    expect(cancelled).toBe(true);
    expect(stream.locked).toBe(false);
  });
}

test('declared oversized bodies are cancelled before reading their contents', async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(new Uint8Array([65]));
      },
      cancel: () => {
        cancelled = true;
      },
    }),
    { headers: { 'content-length': '100' } },
  );
  const request = createRequester({ fetch: () => Promise.resolve(response) });
  const result: unknown = Reflect.apply(request, undefined, [
    'https://original.invalid/body',
    'text',
    { maxResponseBytes: 4 },
  ]);
  await expect(result).rejects.toThrow(RangeError);
  expect(cancelled).toBe(true);
});
