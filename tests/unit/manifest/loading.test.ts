/** JSON source discovery preserves inline navigation bases, typed overrides, cancellation, and failed-open cleanup. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { jsonFiles, jsonManifest, jsonTransport } from './fixture';

test('inline page destinations remain relative to JSON even when a separate nav resource is declared', async () => {
  const files = jsonFiles();
  files.set(
    'OPS/manifest.json',
    JSON.stringify({
      ...jsonManifest(),
      resources: [{ href: 'unused/navigation.xhtml', rel: 'contents' }],
    }),
  );
  const transport = jsonTransport(files);
  const book = await Book.open('https://original.invalid/OPS/manifest.json', {
    fetch: transport.fetch,
  });
  try {
    expect(book.publication.navPath).toBeNull();
    await book.pageList.generate();
    expect(book.pageList.entries[0]?.cfi).toContain('[chapter]');
    expect(transport.calls).toEqual(['OPS/manifest.json', 'OPS/text/chapter one.xhtml']);
  } finally {
    book.destroy();
  }
});

test('explicit JSON type hints and base URLs use the same normalized resource provider', async () => {
  const files = jsonFiles();
  files.set('OPS/publication', files.get('OPS/manifest.json') ?? '');
  const transport = jsonTransport(files);
  const book = await Book.open('publication', {
    type: 'json',
    baseUrl: 'https://original.invalid/OPS/',
    fetch: transport.fetch,
  });
  try {
    expect(book.packagePath).toBe('OPS/publication');
    expect(await book.section()?.search('Original JSON')).toHaveLength(1);
  } finally {
    book.destroy();
  }
});

test('failed JSON parsing aborts the owned source and pre-cancellation starts no transport', async () => {
  let owned: AbortSignal | null | undefined;
  let calls = 0;
  const fetcher: typeof fetch = (_input, init) => {
    owned = init?.signal;
    calls += 1;
    return Promise.resolve(new Response('{broken'));
  };
  await expect(
    Book.open('https://original.invalid/manifest.json', { fetch: fetcher }),
  ).rejects.toThrow();
  expect(owned?.aborted).toBe(true);
  const controller = new AbortController();
  controller.abort();
  await expect(
    Book.open('https://original.invalid/manifest.json', {
      fetch: fetcher,
      signal: controller.signal,
    }),
  ).rejects.toThrow();
  expect(calls).toBe(1);
});
