/** Headless destination tests cover identity, path bases, validation, and progress generation. */
import { afterEach, expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { resolveDisplayTarget } from '../../../src/render/target';
import type { DisplayTarget } from '../../../src/render/target';
import { bookFiles, bookZip } from '../book/fixture';

const opened: Book[] = [];
afterEach(() => opened.splice(0).forEach((book) => book.destroy()));

/** Open an original fixture and register deterministic cleanup. */
async function publication(files = bookFiles()): Promise<Book> {
  const book = await Book.open(bookZip(files));
  opened.push(book);
  return book;
}

/** Resolve with a fresh non-aborted signal. */
function resolve(book: Book, target?: DisplayTarget) {
  return resolveDisplayTarget(book, null, target, new AbortController().signal);
}

test('resolves indices, itemref IDs, normalized hrefs and fragments', async () => {
  const book = await publication();
  for (const target of [undefined, 0, '#chapter', 'text/./chapter%20one.xhtml']) {
    expect((await resolve(book, target)).section.idref).toBe('chapter');
  }
  expect((await resolve(book, '#anchor%20one')).fragment).toBe('anchor one');
  expect((await resolve(book, 'text/chapter%20one.xhtml#end')).fragment).toBe('end');
  expect(
    (await resolve(book, { href: '../text/chapter%20one.xhtml#end', from: 'OPS/nav/toc.xhtml' }))
      .fragment,
  ).toBe('end');
  expect((await resolve(book, { href: 'text/chapter%20one.xhtml' })).section.index).toBe(0);
});

test('prefers the current chapter for fragment-only links and parses CFIs', async () => {
  const book = await publication();
  const current = book.section();
  const result = await resolveDisplayTarget(book, current, '#end', new AbortController().signal);
  expect(result.section).toBe(current);
  const cfi = 'epubcfi(/6/2[chapter]!/4/2/1:2)';
  expect((await resolve(book, `#${cfi}`)).cfi?.toString()).toBe(cfi);
});

test('generates progress lazily and reuses an existing index', async () => {
  const book = await publication();
  expect(book.locations.length).toBe(0);
  const end = await resolve(book, { percentage: 1 });
  expect(end.cfi?.toString()).toBe(book.locations.cfiFromPercentage(1));
  const entries = book.locations.entries;
  expect((await resolve(book, { percentage: 0 })).section.index).toBe(0);
  expect(book.locations.entries).toBe(entries);
});

test('rejects missing chapters, foreign resources, malformed fragments and invalid progress', async () => {
  const book = await publication();
  for (const target of [
    99,
    'missing.xhtml',
    'images/cover.jpg',
    'https://example.test/chapter.xhtml',
    '#%zz',
    { percentage: -1 },
    { percentage: 2 },
    { percentage: NaN },
  ]) {
    await expect(resolve(book, target)).rejects.toThrow();
  }
  expect(book.locations.length).toBe(0);
  const controller = new AbortController();
  controller.abort();
  await expect(resolveDisplayTarget(book, null, undefined, controller.signal)).rejects.toThrow();
});

test('rejects an empty reading corpus and a spine with no linear entry', async () => {
  const files = bookFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body/></html>',
  );
  const empty = await publication(files);
  await expect(resolve(empty, { percentage: 0.5 })).rejects.toThrow('no indexed reading content');
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace('idref="chapter"', 'idref="chapter" linear="no"'),
  );
  await expect(resolve(await publication(files))).rejects.toThrow('not in the spine');
});
