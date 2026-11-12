/** Optional vendor-file discovery ignores only known absence while preserving HTTP errors and cancellation. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { appleFiles, appleXml } from './fixture';
import { bookFiles } from '../book/fixture';
import { OfflineMissError } from '../../../src/offline/store';

/** Decode directory and direct-OPF requests using the same origin-root source boundary as real transports. */
function transport(
  files: ReadonlyMap<string, string>,
  status = 404,
): {
  fetch: typeof fetch;
  calls: readonly string[];
} {
  const calls: string[] = [];
  return {
    calls,
    fetch: (input) => {
      const path = decodeURIComponent(
        new Request(input).url.replace('https://original.invalid/', ''),
      );
      calls.push(path);
      const body = files.get(path);
      return Promise.resolve(
        new Response(body ?? 'missing', { status: body === undefined ? status : 200 }),
      );
    },
  };
}

test('directories discover missing-layout defaults and direct OPF discovery requires explicit opt-in', async () => {
  const files = appleFiles();
  const first = transport(files);
  const directory = await Book.open('https://original.invalid/', { fetch: first.fetch });
  expect(directory.publication.rendition.layout).toBe('pre-paginated');
  expect(first.calls).toContain('META-INF/com.apple.ibooks.display-options.xml');
  directory.destroy();
  const direct = transport(files);
  const skipped = await Book.open('https://original.invalid/OPS/package.opf', {
    fetch: direct.fetch,
  });
  expect(skipped.displayOptions).toBeNull();
  expect(direct.calls).not.toContain('META-INF/com.apple.ibooks.display-options.xml');
  skipped.destroy();
  const enabled = await Book.open('https://original.invalid/OPS/package.opf', {
    fetch: direct.fetch,
    appleDisplayOptions: true,
  });
  expect(enabled.displayOptions?.fixedLayout).toBe(true);
  enabled.destroy();
});

test('known absence is optional while server failures and malformed present documents reject', async () => {
  const files = appleFiles();
  files.delete('META-INF/com.apple.ibooks.display-options.xml');
  const absent = await Book.open('https://original.invalid/', { fetch: transport(files).fetch });
  expect(absent.displayOptions).toBeNull();
  absent.destroy();
  await expect(
    Book.open('https://original.invalid/', { fetch: transport(files, 500).fetch }),
  ).rejects.toThrow('500');
  files.set('META-INF/com.apple.ibooks.display-options.xml', '<wrong/>');
  await expect(
    Book.open('https://original.invalid/', { fetch: transport(files).fetch }),
  ).rejects.toThrow('display_options');
});

test('modern directory layout avoids unnecessary discovery unless explicitly requested', async () => {
  const files = bookFiles();
  files.set('META-INF/com.apple.ibooks.display-options.xml', appleXml());
  const request = transport(files);
  const skipped = await Book.open('https://original.invalid/', { fetch: request.fetch });
  expect(skipped.displayOptions).toBeNull();
  skipped.destroy();
  expect(request.calls).not.toContain('META-INF/com.apple.ibooks.display-options.xml');
  const explicit = await Book.open('https://original.invalid/', {
    fetch: request.fetch,
    appleDisplayOptions: true,
  });
  expect(explicit.displayOptions?.fixedLayout).toBe(true);
  expect(explicit.publication.rendition.layout).toBe('reflowable');
  explicit.destroy();
});

test('an offline optional-file miss does not prevent reopening an otherwise cached directory', async () => {
  const files = appleFiles();
  const source = transport(files);
  const fetcher: typeof fetch = (input, init) => {
    if (new Request(input).url.includes('display-options.xml')) {
      return Promise.reject(
        new OfflineMissError(
          'https://original.invalid/META-INF/com.apple.ibooks.display-options.xml',
        ),
      );
    }
    return source.fetch(input, init);
  };
  const book = await Book.open('https://original.invalid/', { fetch: fetcher });
  expect(book.displayOptions).toBeNull();
  book.destroy();
});
