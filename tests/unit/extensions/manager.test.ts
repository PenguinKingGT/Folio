/** Custom manager ownership remains headless and asynchronous destruction invokes each custom owner exactly once. */
import { expect, test } from 'vitest';
import { searchBook } from '../search/fixture';
import type { ManagedReader } from '../../../src/index';

test('custom managers receive typed options and are destroyed once across concurrent asynchronous closure', async () => {
  const book = await searchBook();
  const section = book.section();
  if (!section) {
    throw new Error('Missing custom-manager chapter.');
  }
  let destroyed = 0;
  const reader = book.renderWith(
    (publication, target, options: { label: string }): ManagedReader => {
      expect(publication).toBe(book);
      expect(target).toBe('#host-owned');
      expect(options.label).toBe('original');
      return {
        display: async () => {
          await section.load();
          return section;
        },
        getContents: () => null,
        destroy: () => {
          destroyed += 1;
        },
      };
    },
    '#host-owned',
    { label: 'original' },
  );
  expect(await reader.display()).toBe(section);
  expect(reader.getContents()).toBeNull();
  const closing = book.destroyAsync();
  expect(book.destroyAsync()).toBe(closing);
  expect(() => book.renderWith(() => reader, '#later', {})).toThrow('closing');
  await closing;
  book.destroy();
  expect(destroyed).toBe(1);
});

test('custom manager factories validate executable host inputs and the returned navigation/cleanup contract', async () => {
  const book = await searchBook();
  try {
    for (const factory of [null, () => null, () => ({}), () => ({ display: () => {} })]) {
      expect(() => {
        Reflect.apply(book.renderWith.bind(book), book, [factory, '#host', {}]);
      }).toThrow(TypeError);
    }
  } finally {
    book.destroy();
  }
});

test('asynchronous destruction closes every owner when a custom manager cleanup throws', async () => {
  const book = await searchBook();
  let cleaned = false;
  book.renderWith(
    () => ({
      display: () => Promise.reject(new Error('unused manager')),
      getContents: () => null,
      destroy: () => {
        throw new Error('custom cleanup');
      },
    }),
    '#first',
    {},
  );
  book.renderWith(
    () => ({
      display: () => Promise.reject(new Error('unused manager')),
      getContents: () => null,
      destroy: () => {
        cleaned = true;
      },
    }),
    '#second',
    {},
  );
  await expect(book.destroyAsync()).rejects.toThrow(AggregateError);
  expect(cleaned).toBe(true);
  expect(() => book.on('error', () => {})).toThrow('destroyed');
  book.destroy();
});
