/** Headless match CFIs must resolve to exact native Unicode text and work directly with reader annotations. */
import { expect, test } from 'vitest';
import { Book, Cfi, rangeFromCfi } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { searchFiles, searchChapter } from '../../unit/search/fixture';
import { host } from '../render/fixture';

test('resolves cross-node, whitespace, CDATA and Unicode case-fold matches to actual native ranges', async () => {
  const book = await Book.open(bookZip(searchFiles(true)));
  const container = host();
  const reader = book.renderTo(container);
  try {
    await reader.display();
    const document = reader.getContents();
    const section = book.section();
    if (!document || !section) {
      throw new Error('Missing native search chapter.');
    }
    const before = document.body.innerHTML;
    for (const query of ['original text', 'one two three', 'abcdef', 'σ', '𐐨', 'ß', '.*', '[a]']) {
      const results = await section.search(query);
      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.cfi.startsWith('epubcfi(/8/2[chapter]!')).toBe(true);
        const range = rangeFromCfi(document, result.cfi);
        expect(range.toString().replace(/\s+/gu, ' ')).toBe(result.match);
        expect(new Cfi(result.cfi).isRange).toBe(true);
      }
    }
    const result = (await section.search('original text'))[0];
    if (!result) {
      throw new Error('Missing phrase search result.');
    }
    await reader.display(result.cfi);
    const annotation = reader.annotations.highlight(result.cfi);
    expect(reader.annotations.element.querySelector('rect')).not.toBeNull();
    expect(reader.annotations.get(annotation.id)?.cfi).toBe(result.cfi);
    expect(document.body.innerHTML).toBe(before);
  } finally {
    book.destroy();
    container.remove();
  }
});

test('preserves exact CFI structure without ID assertion recovery', async () => {
  const files = searchFiles();
  files.set('OPS/text/chapter one.xhtml', searchChapter.replace(/\s+id="[^"]*"/g, ''));
  const book = await Book.open(bookZip(files));
  const container = host();
  const reader = book.renderTo(container);
  try {
    await reader.display();
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing unasserted native chapter.');
    }
    const result = (await book.section()?.search('original text'))?.[0];
    if (!result) {
      throw new Error('Missing unasserted search match.');
    }
    const range = rangeFromCfi(document, result.cfi);
    expect(range.startContainer.nodeValue).toBe('or');
    expect(range.startOffset).toBe(0);
    expect(range.endContainer.nodeValue).toBe('text');
    expect(range.endOffset).toBe(4);
    expect(range.toString()).toBe('original text');
  } finally {
    book.destroy();
    container.remove();
  }
});

test('cross-block phrases map to native paragraph boundaries rather than invented separator characters', async () => {
  const book = await Book.open(bookZip(searchFiles()));
  const container = host();
  const reader = book.renderTo(container);
  try {
    await reader.display();
    const document = reader.getContents();
    const result = (await book.section()?.search('BlockFirst BlockSecond'))?.[0];
    if (!document || !result) {
      throw new Error('Missing cross-block match.');
    }
    const range = rangeFromCfi(document, result.cfi);
    expect(range.startContainer.nodeValue).toBe('BlockFirst');
    expect(range.endContainer.nodeValue).toBe('BlockSecond');
    expect(range.startOffset).toBe(0);
    expect(range.endOffset).toBe('BlockSecond'.length);
  } finally {
    book.destroy();
    container.remove();
  }
});
