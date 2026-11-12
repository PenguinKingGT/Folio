/** Legacy display discovery fills absent package defaults and never overrides modern metadata or host policy. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip, bookFiles } from '../book/fixture';
import { appleFiles, appleXml } from './fixture';

test('EPUB 2 archive discovery applies layout, spread and orientation fallbacks without rewriting package metadata', async () => {
  const files = appleFiles();
  const original = files.get('OPS/package.opf');
  const book = await Book.open(bookZip(files));
  try {
    expect(book.publication.version).toBe('2.0');
    expect(book.displayOptions?.interactive).toBe(true);
    expect(book.publication.rendition).toEqual({
      layout: 'pre-paginated',
      spread: 'both',
      orientation: 'landscape',
    });
    expect(files.get('OPS/package.opf')).toBe(original);
  } finally {
    book.destroy();
  }
});

test('modern rendition metadata wins while platform-specific legacy settings fill only missing defaults', async () => {
  const files = bookFiles();
  files.set(
    'META-INF/com.apple.ibooks.display-options.xml',
    '<display_options><platform name="ipad"><option name="fixed-layout">true</option><option name="open-to-spread">false</option><option name="orientation-lock">portrait-only</option></platform></display_options>',
  );
  const book = await Book.open(bookZip(files), { applePlatform: 'ipad' });
  try {
    expect(book.displayOptions?.fixedLayout).toBe(true);
    expect(book.publication.rendition).toEqual({
      layout: 'reflowable',
      spread: 'none',
      orientation: 'portrait',
    });
  } finally {
    book.destroy();
  }
});

test('absent and disabled vendor files preserve modern reading while present malformed XML rejects', async () => {
  const absent = await Book.open(bookZip(bookFiles()));
  expect(absent.displayOptions).toBeNull();
  absent.destroy();
  const malformed = appleFiles('<broken');
  await expect(Book.open(bookZip(malformed))).rejects.toThrow();
  const disabled = await Book.open(bookZip(malformed), { appleDisplayOptions: false });
  expect(disabled.displayOptions).toBeNull();
  disabled.destroy();
  const explicit = await Book.open(
    bookZip(
      appleFiles(
        appleXml(
          '<option name="fixed-layout">false</option><option name="orientation-lock">none</option>',
        ),
      ),
    ),
  );
  expect(explicit.publication.rendition).toMatchObject({
    layout: 'reflowable',
    orientation: 'auto',
  });
  explicit.destroy();
});

test('invalid display discovery options reject before any transport starts', async () => {
  let calls = 0;
  const fetcher: typeof fetch = () => {
    calls += 1;
    return Promise.resolve(new Response('unused'));
  };
  for (const options of [{ appleDisplayOptions: 'yes' }, { applePlatform: 'android' }]) {
    const operation: unknown = Reflect.apply(Book.open.bind(Book), Book, [
      'https://original.invalid/book.epub',
      { ...options, fetch: fetcher },
    ]);
    await expect(operation).rejects.toThrow();
  }
  expect(calls).toBe(0);
});
