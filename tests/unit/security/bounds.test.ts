/** Response configuration, decoded size boundaries, and pathological chunk counts are independently bounded. */
import { expect, test } from 'vitest';
import { createRequester } from '../../../src/index';

test.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid byte limit %s before transport invocation',
  async (limit) => {
    let calls = 0;
    const fetcher: typeof fetch = () => {
      calls++;
      return Promise.resolve(new Response('safe'));
    };
    expect(() => createRequester({ maxResponseBytes: limit, fetch: fetcher })).toThrow(RangeError);
    const request = createRequester({ fetch: fetcher });
    await expect(
      request('https://original.invalid/', 'text', { maxResponseBytes: limit }),
    ).rejects.toThrow(RangeError);
    expect(calls).toBe(0);
  },
);

test('accepts exact limits, supports per-request settings, and remains usable after a failure', async () => {
  const request = createRequester({
    maxResponseBytes: 3,
    fetch: () => Promise.resolve(new Response('safe')),
  });
  await expect(request('https://original.invalid/', 'text')).rejects.toThrow(RangeError);
  expect(await request('https://original.invalid/', 'text', { maxResponseBytes: 4 })).toBe('safe');
  await expect(request('https://original.invalid/', 'text')).rejects.toThrow(RangeError);
});

test('bounds even zero-byte chunks and releases a pathological producer', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull: (controller) => controller.enqueue(new Uint8Array()),
    cancel: () => {
      cancelled = true;
    },
  });
  const request = createRequester({ fetch: () => Promise.resolve(new Response(stream)) });
  await expect(request('https://original.invalid/', 'binary')).rejects.toThrow('chunk limit');
  expect(cancelled).toBe(true);
  expect(stream.locked).toBe(false);
});
