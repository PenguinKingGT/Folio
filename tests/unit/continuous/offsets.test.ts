/** Virtual spine prefix sums retain measured extents and protect browser layout limits atomically. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { ChapterOffsets } from '../../../src/continuous/offsets';
import { readyWindow } from '../../../src/continuous/candidates';
import { bookZip } from '../book/fixture';
import { continuousFiles } from '../../browser/continuous/fixture';

test('converts logical coordinates and neighbor windows with measured and estimated chapters', async () => {
  const book = await Book.open(bookZip(continuousFiles(4)));
  try {
    const offsets = new ChapterOffsets(book.spine.all());
    const first = book.section(0);
    if (!first) {
      throw new Error('Missing original chapter fixture.');
    }
    expect(
      readyWindow(
        [],
        [first],
        first,
        {
          axis: 'vertical',
          reverse: false,
          direction: 'ltr',
          writingMode: 'horizontal-tb',
        },
        [],
      ).pages,
    ).toEqual([]);
    offsets.update([{ index: 1, extent: 100 }], 240);
    expect(offsets.total).toBe(820);
    expect(offsets.start(2)).toBe(340);
    expect(offsets.extent(1)).toBe(100);
    expect(offsets.extent(3)).toBe(240);
    expect(offsets.at(239)?.index).toBe(0);
    expect(offsets.at(240)?.index).toBe(1);
    expect(offsets.at(9999)?.index).toBe(3);
    expect(offsets.at(NaN)).toBeNull();
    expect(offsets.window(1, 1, 1).map((section) => section.index)).toEqual([0, 1, 2]);
    expect(offsets.window(99, 1, 1)).toEqual([]);
    expect(offsets.adjacent(99, 1)).toBeNull();
    expect(offsets.start(99)).toBe(0);
    offsets.update([], 200, true);
    expect(offsets.extent(1)).toBe(200);
    const previous = offsets.total;
    for (const extent of [-1, NaN, 17_000_000]) {
      expect(() => offsets.update([{ index: 1, extent }], 200)).toThrow(RangeError);
    }
    expect(offsets.total).toBe(previous);
    for (const estimate of [0, NaN]) {
      expect(() => offsets.update([], estimate)).toThrow(RangeError);
    }
  } finally {
    book.destroy();
  }
});

test('includes requested appendices in spine order and rolls back overflowing insertions', async () => {
  const files = continuousFiles(4);
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '')
      .replaceAll('idref="s1"', 'idref="s1" linear="no"')
      .replaceAll('idref="s3"', 'idref="s3" linear="no"'),
  );
  const book = await Book.open(bookZip(files));
  try {
    const offsets = new ChapterOffsets(book.spine.all());
    const appendix = book.section(1);
    const last = book.section(3);
    if (!appendix || !last) {
      throw new Error('Missing original appendix fixture.');
    }
    offsets.update([], 8_000_000);
    expect(() => offsets.include(appendix)).toThrow('limit');
    expect(offsets.all().map((section) => section.index)).toEqual([0, 2]);
    expect(offsets.total).toBe(16_000_000);
    offsets.update([], 100);
    offsets.include(appendix);
    offsets.include(last);
    offsets.include(last);
    expect(offsets.all().map((section) => section.index)).toEqual([0, 1, 2, 3]);
    expect(offsets.total).toBe(400);
    expect(offsets.adjacent(3, 1)).toBeNull();
    const empty = new ChapterOffsets([]);
    expect(empty.at(0)).toBeNull();
    expect(empty.total).toBe(0);
  } finally {
    book.destroy();
  }
});
