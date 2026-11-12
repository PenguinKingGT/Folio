/** Stream ownership preserves standard decoding while releasing locks on failure and cancellation before I/O. */
import { expect, test } from 'vitest';
import { createRequester } from '../../../src/index';

test('null/empty bodies preserve native text, binary, Blob MIME, and JSON error behavior', async () => {
  const request = createRequester({
    fetch: () => Promise.resolve(new Response(null, { status: 204 })),
  });
  expect(await request('https://original.invalid/empty', 'text')).toBe('');
  expect((await request('https://original.invalid/empty', 'binary')).byteLength).toBe(0);
  expect((await request('https://original.invalid/empty', 'blob')).size).toBe(0);
  await expect(request('https://original.invalid/empty', 'json')).rejects.toThrow(SyntaxError);
  const typed = createRequester({
    fetch: () =>
      Promise.resolve(
        new Response('Original', { headers: { 'content-type': 'Text/Plain; Charset=UTF-8' } }),
      ),
  });
  const blob = await typed('https://original.invalid/blob', 'blob');
  expect(blob.type).toBe('text/plain;charset=utf-8');
  expect(await blob.text()).toBe('Original');
});

test('stream failure retains its original error and releases its read lock', async () => {
  const failure = new Error('Original stream error');
  const stream = new ReadableStream<Uint8Array>({
    pull: (controller) => {
      controller.error(failure);
    },
  });
  const response = new Response(stream);
  const request = createRequester({ fetch: () => Promise.resolve(response) });
  await expect(request('https://original.invalid/failure', 'binary')).rejects.toBe(failure);
  expect(stream.locked).toBe(false);
});

test('abort before the transport microtask prevents unnecessary invocation', async () => {
  let called = false;
  const request = createRequester({
    fetch: () => {
      called = true;
      return Promise.resolve(new Response('late'));
    },
  });
  const controller = new AbortController();
  const operation = request('https://original.invalid/not-started', 'text', {
    signal: controller.signal,
  });
  controller.abort();
  await expect(operation).rejects.toThrow();
  expect(called).toBe(false);
});
