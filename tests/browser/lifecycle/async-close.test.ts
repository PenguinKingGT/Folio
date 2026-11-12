/** Book async destruction must include unload work queued by cancellation of an uncommitted native render hook. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { host } from '../render/fixture';
import { gate } from '../../unit/extensions/fixture';

test('destroyAsync waits for unload queued after a pending native render hook is cancelled', async () => {
  const book = await Book.open(bookZip());
  const container = host();
  const reader = book.renderTo(container);
  const started = gate();
  const held = gate();
  let completed = false;
  book.hooks.render.register(async () => {
    started.release();
    await held.promise;
  });
  book.hooks.unload.register(async () => {
    await Promise.resolve();
    expect(await book.text('images/cover.jpg')).toBe('original cover bytes');
    completed = true;
  });
  book.on('destroyed', () => {
    expect(completed).toBe(true);
  });
  const rejected = expect(reader.display()).rejects.toThrow();
  try {
    await started.promise;
    await expect(book.destroyAsync()).resolves.toBeUndefined();
    await rejected;
    expect(completed).toBe(true);
    expect(container.children).toHaveLength(0);
  } finally {
    held.release();
    await rejected;
    book.destroy();
    container.remove();
  }
});
