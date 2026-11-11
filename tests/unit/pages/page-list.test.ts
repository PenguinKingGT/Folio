/** Printed-page conversions retain Roman/repeated labels and use authored order for percentages. */
import { expect, test } from 'vitest';
import { PageList } from '../../../src/index';
import { cfi, link } from './fixture';

test('converts labels, positions, and ordinal progress without numeric coercion', async () => {
  const pages = new PageList([
    link('iv'),
    link('1', `chapter.xhtml#${cfi(20)}`),
    link('1', `#${cfi(30)}`),
  ]);
  expect(pages.length).toBe(3);
  expect(pages.get('iv')?.index).toBe(0);
  expect(pages.get(1)?.index).toBe(1);
  expect(pages.at(2)?.label).toBe('1');
  expect(pages.at(99)).toBeNull();
  expect(pages.cfiFromPage(1)).toBe(cfi(20));
  expect(pages.cfiFromPage('missing')).toBeNull();
  expect(pages.percentageFromPage('iv')).toBe(0);
  expect(pages.percentageFromPage(1)).toBe(0.5);
  expect(pages.percentageFromPage('missing')).toBeNull();
  expect(pages.pageFromCfi(cfi(0))).toBeNull();
  expect(pages.pageFromCfi(cfi(25))?.index).toBe(1);
  expect(pages.pageFromCfi(cfi(999))?.index).toBe(2);
  expect(pages.percentageFromCfi(cfi(0))).toBeNull();
  expect(pages.percentageFromCfi(cfi(25))).toBe(0.5);
  expect(pages.percentageFromCfi(cfi(30))).toBe(1);
  expect(pages.pageFromPercentage(0)?.label).toBe('iv');
  expect(pages.pageFromPercentage(0.99)?.index).toBe(1);
  expect(pages.cfiFromPercentage(1)).toBe(cfi(30));
  expect(Object.isFrozen(pages.entries)).toBe(true);
  expect(Object.isFrozen(pages.entries[0])).toBe(true);
  await pages.generate();
  expect(pages.cfiFromPage('iv')).toBe(cfi(10));
});

test('handles absent, single-page, and unresolved page lists', async () => {
  const empty = new PageList();
  expect(empty.get('1')).toBeNull();
  expect(empty.pageFromCfi('invalid')).toBeNull();
  expect(empty.pageFromPercentage(1)).toBeNull();
  expect(empty.cfiFromPercentage(0)).toBeNull();
  expect(await empty.generate()).toEqual([]);
  const single = new PageList([link('01')]);
  expect(single.percentageFromPage('01')).toBe(0);
  expect(single.get(1)).toBeNull();
  const unresolved = new PageList([link('  A  1 ', 'chapter.xhtml#page')]);
  expect(unresolved.get('A 1')?.cfi).toBeNull();
  expect(unresolved.pageFromCfi(cfi(30))).toBeNull();
  const previous = unresolved.entries;
  await expect(unresolved.generate()).rejects.toThrow('resolver');
  expect(unresolved.entries).toBe(previous);
});

test('rejects malformed input, oversized lists, reverse ordering, and invalid percentages', () => {
  for (const value of [link(''), link('1', ''), link('1', '#epubcfi(bad)'), link('1', '#%zz')]) {
    expect(() => new PageList([value])).toThrow();
  }
  expect(() => new PageList([link('1', `#${cfi(30)}`), link('2')])).toThrow('reading order');
  const entry = link('1');
  expect(() => new PageList(Array.from({ length: 10_001 }, () => entry))).toThrow('limit');
  const pages = new PageList([entry]);
  for (const percentage of [-1, 2, NaN, Infinity]) {
    expect(() => pages.pageFromPercentage(percentage)).toThrow(RangeError);
  }
});

test('keeps previous entries after resolver failure or newly detected reverse ordering', async () => {
  let failed = false;
  const pages = new PageList(
    [link('1', 'chapter.xhtml#one'), link('2', 'chapter.xhtml#two')],
    (entry) => {
      if (failed) {
        return Promise.reject(new Error('original failure'));
      }
      return Promise.resolve(cfi(entry.index * 10));
    },
  );
  await pages.generate();
  const previous = pages.entries;
  failed = true;
  await expect(pages.generate()).rejects.toThrow('original failure');
  expect(pages.entries).toBe(previous);
  const reversed = new PageList([link('1', 'one'), link('2', 'two')], (entry) =>
    Promise.resolve(cfi(20 - entry.index * 10)),
  );
  await expect(reversed.generate()).rejects.toThrow('reading order');
  expect(reversed.entries.every((entry) => entry.cfi === null)).toBe(true);
});
