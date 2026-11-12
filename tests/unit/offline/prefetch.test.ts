/** Resource prefetch uses the book's normal byte provider and cancellation instead of retaining separate copies. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip } from '../book/fixture';

test('prefetch reads each manifest resource and validates caller/book lifetime before I/O', async () => {
  const book = await Book.open(bookZip());
  const loaded: string[] = [];
  book.on('resourceLoaded', (event) => loaded.push(event.href));
  expect(await book.prefetchResources()).toBe(book.publication.manifest.size);
  expect(loaded).toEqual(Array.from(book.publication.manifest.values(), (item) => item.href));
  const before = loaded.length;
  const controller = new AbortController();
  controller.abort();
  await expect(book.prefetchResources(controller.signal)).rejects.toThrow();
  expect(loaded).toHaveLength(before);
  book.destroy();
  await expect(book.prefetchResources()).rejects.toThrow();
});

test('cancellation during resource callbacks prevents subsequent prefetch requests', async () => {
  const book = await Book.open(bookZip());
  const controller = new AbortController();
  let read = 0;
  book.on('resourceLoaded', () => {
    read += 1;
    controller.abort();
  });
  try {
    await expect(book.prefetchResources(controller.signal)).rejects.toThrow();
    expect(read).toBe(1);
  } finally {
    book.destroy();
  }
});
