/** Character/word indexes and lookup remain layout-independent and monotonic. */
import { expect, test } from 'vitest';
import { Book, Cfi } from '../../../src/index';
import { bookFiles, bookZip } from '../book/fixture';
import { locations } from './fixture';

test('generates weighted character progress and supports all lookup directions', async () => {
  const index = locations();
  expect(index.current).toBeNull();
  expect(index.cfiFromPercentage(0.5)).toBeNull();
  expect(index.locationFromCfi('not parsed before generation')).toBeNull();
  expect(index.percentageFromCfi('not parsed before generation')).toBeNull();
  const entries = await index.generate({ breakSize: 3 });
  expect(index.total).toBe(21);
  expect(index.unit).toBe('characters');
  expect(index.breakSize).toBe(3);
  expect(index.length).toBeGreaterThan(5);
  expect(new Cfi(entries[0]?.cfi ?? '').spineId).toBe('a');
  expect(new Cfi(entries[entries.length - 1]?.cfi ?? '').spineId).toBe('b');
  for (let current = 1; current < entries.length; current += 1) {
    expect(new Cfi(entries[current - 1]?.cfi ?? '').compare(entries[current]?.cfi ?? '')).toBe(-1);
  }
  expect(index.cfiFromPercentage(0)).toBe(index.cfiFromLocation(0));
  expect(index.percentageFromCfi(index.cfiFromPercentage(1) ?? '')).toBe(1);
  expect(index.percentageFromLocation(0)).toBe(0);
  expect(index.cfiFromLocation(-1)).toBeNull();
  expect(index.locationFromCfi('epubcfi(/6/200!/4/2/1:0)')).toBeNull();
  expect(index.locationFromCfi('epubcfi(/6/4[note]!/4/2/1:0)')).toBeNull();
  expect(index.locationFromCfi('epubcfi(/4/2)')).toBeNull();
  expect(index.locationFromCfi('epubcfi(/6/2[wrong]!/4/2/1:0)')).toBeNull();
  expect(() => index.percentageFromLocation(999)).toThrow(RangeError);
  index.setCurrent(1);
  expect(index.current).toBe(1);
  index.setCurrent(entries[0]?.cfi ?? '');
  expect(index.current).toBe(0);
  expect(() => index.setCurrent(-1)).toThrow(RangeError);
  expect(Object.isFrozen(entries)).toBe(true);
});

test('counts words across inline markup and separates adjacent block text', async () => {
  const index = locations('<p>Alpha <em>be</em>ta</p><p>Gamma</p>', '<p>delta!</p>');
  await index.generate({ unit: 'words', breakSize: 2 });
  expect(index.total).toBe(4);
  expect(index.unit).toBe('words');
  expect(index.percentageFromCfi(index.cfiFromPercentage(1) ?? '')).toBe(1);
  const fallback = locations('<p>One two</p>', '<p>Three</p>', '!invalid');
  await fallback.generate({ unit: 'words' });
  expect(fallback.total).toBe(3);
});

test('never samples the middle of a surrogate pair and supports empty publications', async () => {
  const index = locations('<p>😀</p>', '');
  const entries = await index.generate({ breakSize: 1 });
  expect(index.total).toBe(2);
  expect(entries.map((entry) => entry.position)).toEqual([0, 2]);
  expect(index.load(index.save())).toEqual(entries);
  const empty = locations('', '<p>  </p>');
  await empty.generate();
  expect(empty.length).toBe(0);
  expect(empty.total).toBe(0);
  expect(() => empty.setCurrent(0)).toThrow(RangeError);
  expect(empty.load(empty.save())).toEqual([]);
  await empty.generate({ unit: 'words' });
  expect(empty.length).toBe(0);
});

test('uses the actual OPF spine step instead of assuming /6', async () => {
  const files = bookFiles();
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace('<metadata>', '<extension/><metadata>'),
  );
  const book = await Book.open(bookZip(files));
  const entries = await book.locations.generate();
  expect(entries[0]?.cfi).toContain('/8/2[chapter]');
  expect(book.locations.load(book.locations.save())).toEqual(entries);
  book.destroy();
  await expect(book.locations.generate()).rejects.toThrow('destroyed');
  const index = locations('<p>test</p>', '');
  await expect(index.generate({ breakSize: 0 })).rejects.toThrow(RangeError);
  await expect(index.generate({ breakSize: 1.5 })).rejects.toThrow(RangeError);
  for (const value of [-1, 1.1, Number.NaN]) {
    expect(() => index.cfiFromPercentage(value)).toThrow(RangeError);
  }
});
