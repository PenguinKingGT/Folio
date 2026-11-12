/** Invalid queries/options fail before chapter IO and successful searches reflect the latest loaded document. */
import { expect, test, vi } from 'vitest';
import { searchBook, searchFiles } from './fixture';
import { Book } from '../../../src/index';
import { bookZip } from '../book/fixture';

test('validates runtime query/option boundaries before requesting body text', async () => {
  const book = await searchBook();
  const reads = vi.spyOn(book, 'text');
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing validation chapter.');
    }
    const search = section.search.bind(section);
    for (const query of ['', ' \n ', 'x'.repeat(1025), 1, null]) {
      const operation: unknown = Reflect.apply(search, undefined, [query]);
      await expect(operation).rejects.toThrow();
    }
    for (const options of [
      null,
      [],
      { limit: 0 },
      { limit: 1001 },
      { limit: 1.5 },
      { context: -1 },
      { context: 257 },
      { context: 0.5 },
      { caseSensitive: 1 },
      { caseSensitive: null },
      { normalizeWhitespace: 'yes' },
      { overlap: 'yes' },
      { signal: {} },
      { signal: null },
    ]) {
      const operation: unknown = Reflect.apply(search, undefined, ['original', options]);
      await expect(operation).rejects.toThrow();
    }
    await expect(
      section.search('original', { signal: AbortSignal.abort(new Error('Stopped search')) }),
    ).rejects.toThrow('Stopped search');
    expect(reads).not.toHaveBeenCalled();
    expect(await section.search('original')).toHaveLength(1);
    expect(reads).toHaveBeenCalledTimes(1);
  } finally {
    reads.mockRestore();
    book.destroy();
  }
});

test('searches caller edits without a stale corpus and reloads original content after unload', async () => {
  const book = await searchBook();
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing mutable chapter.');
    }
    const document = await section.load();
    const first = document.getElementById('phrase')?.firstChild;
    if (!first) {
      throw new Error('Missing editable text slot.');
    }
    first.nodeValue = 'Edited ';
    expect(await section.search('Edited original')).toHaveLength(1);
    expect(await section.search('Alpha original')).toEqual([]);
    section.unload();
    expect(await section.search('Alpha original')).toHaveLength(1);
    section.destroy();
    await expect(section.search('original')).rejects.toThrow('destroyed');
    await expect(section.find('original')).rejects.toThrow('destroyed');
  } finally {
    book.destroy();
  }
});

test('rejects oversized or excessively nested search corpora and handles empty reading bodies', async () => {
  for (const body of [
    '<p>' + 'x'.repeat(2_000_001) + '</p>',
    '<div>'.repeat(130) + 'text' + '</div>'.repeat(130),
    '',
  ]) {
    const files = searchFiles();
    files.set(
      'OPS/text/chapter one.xhtml',
      `<html xmlns="http://www.w3.org/1999/xhtml"><body>${body}</body></html>`,
    );
    const book = await Book.open(bookZip(files));
    try {
      const section = book.section();
      if (!section) {
        throw new Error('Missing bounded chapter.');
      }
      if (body === '') {
        expect(await section.search('query')).toEqual([]);
      } else {
        await expect(section.search('query')).rejects.toThrow(RangeError);
      }
    } finally {
      book.destroy();
    }
  }
});
