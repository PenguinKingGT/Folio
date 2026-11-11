/** A fixed reader without displayed pages has no visible location. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { readFixedLocation } from '../../../src/render/fixed-location';
import { bookZip } from '../book/fixture';

test('returns null instead of inventing boundaries for an empty displayed spread', async () => {
  const book = await Book.open(bookZip());
  try {
    expect(readFixedLocation(book, [])).toBeNull();
  } finally {
    book.destroy();
  }
});
