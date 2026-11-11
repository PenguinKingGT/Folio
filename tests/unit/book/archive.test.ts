/** End-to-end headless reading from original EPUB archives, including failure cleanup. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from './fixture';

test.each(['2', '3'] as const)(
  'reads EPUB %s metadata, navigation, chapters and cover without DOM globals',
  async (edition) => {
    expect(typeof globalThis.document).toBe('undefined');
    const book = await Book.open(bookZip(bookFiles(edition)));
    expect(book.publication.metadata.title).toBe('Original title');
    expect(book.packagePath).toBe('OPS/package.opf');
    expect(book.navigation.toc[0]?.href).toBe('text/chapter%20one.xhtml');
    expect(await book.section()?.render()).toContain('Original chapter text');
    expect(await book.text('text/chapter%20one.xhtml')).toContain('<html');
    expect(new TextDecoder().decode(await book.bytes('images/cover.jpg'))).toBe(
      'original cover bytes',
    );
    const asset = await book.resources.url('images/cover.jpg');
    expect(await (await fetch(asset)).text()).toBe('original cover bytes');
    const url = await book.cover.url();
    if (url === null) {
      throw new Error('Expected an original cover.');
    }
    expect(await (await fetch(url)).text()).toBe('original cover bytes');
    book.destroy();
    book.destroy();
    await expect(fetch(url)).rejects.toThrow();
    await expect(book.text('text/chapter%20one.xhtml')).rejects.toThrow();
    expect(() => book.section()).toThrow('destroyed');
  },
);

test('opens binary and Base64 inputs with no declared navigation', async () => {
  const bytes = bookZip(bookFiles('3', false));
  const book = await Book.open(new Uint8Array(bytes).buffer);
  expect(book.navigation.toc).toEqual([]);
  book.destroy();
  const encoded = btoa(String.fromCharCode(...bytes));
  const base64 = await Book.open(encoded, { type: 'base64' });
  expect(await base64.section('#chapter')?.render()).toContain('Original chapter text');
  base64.destroy();
});

test('rejects corrupt containers, invalid packages and invalid navigation', async () => {
  const missing = bookFiles();
  missing.delete('META-INF/container.xml');
  await expect(Book.open(bookZip(missing))).rejects.toThrow('not found');
  const invalidPackage = bookFiles();
  invalidPackage.set('OPS/package.opf', '<root/>');
  await expect(Book.open(bookZip(invalidPackage))).rejects.toThrow('OPF');
  const invalidNav = bookFiles();
  invalidNav.set('OPS/nav.xhtml', '<root/>');
  await expect(Book.open(bookZip(invalidNav))).rejects.toThrow('navigation');
  const remoteNav = bookFiles();
  remoteNav.set(
    'OPS/package.opf',
    (remoteNav.get('OPS/package.opf') ?? '').replace(
      'href="nav.xhtml"',
      'href="https://remote.invalid/nav.xhtml"',
    ),
  );
  await expect(Book.open(bookZip(remoteNav))).rejects.toThrow('local resource');
});

test('rejects unsupported input modes, resource limits and pre-cancelled loads', async () => {
  await expect(Book.open('manifest.json')).rejects.toThrow('F31');
  await expect(Book.open(bookZip(), { archiveLimits: { maxEntries: 1 } })).rejects.toThrow(
    RangeError,
  );
  const controller = new AbortController();
  controller.abort();
  await expect(Book.open(bookZip(), { signal: controller.signal })).rejects.toThrow();
  const book = await Book.open(bookZip());
  await expect(book.bytes('#only-fragment')).rejects.toThrow('fragment alone');
  await expect(book.bytes('images/cover.jpg', undefined, controller.signal)).rejects.toThrow();
  book.destroy();
});
