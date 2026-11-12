/** Real headless owners publish committed operations and release typed listeners on destruction. */
import { expect, expectTypeOf, test } from 'vitest';
import { Book, Locations } from '../../../src/index';
import { bookFiles, bookZip } from '../book/fixture';
import { locations, publication } from '../locations/fixture';

test('book subscriptions observe actual lazy resource reads, failure identity, and one final lifecycle event', async () => {
  const book = await Book.open(bookZip(bookFiles()));
  const loaded: string[] = [];
  const errors: unknown[] = [];
  let destroyed = 0;
  book.on('resourceLoaded', (event) => {
    expectTypeOf(event.bytes).toEqualTypeOf<number>();
    expect(event.from).toBe('OPS/package.opf');
    expect(event.bytes).toBeGreaterThan(0);
    expect(Object.isFrozen(event)).toBe(true);
    loaded.push(event.href);
  });
  book.on('error', (error) => errors.push(error));
  book.once('destroyed', () => {
    destroyed += 1;
  });
  await book.section()?.load();
  expect(loaded).toEqual(['text/chapter%20one.xhtml']);
  let rejected: unknown;
  try {
    await book.bytes('missing.bin');
  } catch (error) {
    rejected = error;
  }
  expect(errors).toEqual([rejected]);
  const controller = new AbortController();
  controller.abort();
  await expect(book.bytes('missing.bin', book.packagePath, controller.signal)).rejects.toThrow();
  expect(errors).toHaveLength(1);
  book.destroy();
  book.destroy();
  expect(destroyed).toBe(1);
  expect(() => book.on('error', () => {})).toThrow('destroyed');
});

test('locations publish generated/restored snapshots and only changed committed positions', async () => {
  const index = locations();
  const events: string[] = [];
  index.on('generated', (entries) => {
    expect(entries).toBe(index.entries);
    events.push('generated');
  });
  index.on('changed', (event) => {
    expectTypeOf(event.index).toEqualTypeOf<number>();
    expect(event.index).toBe(index.current);
    expect(event.cfi).toBe(index.cfiFromLocation(event.index));
    expect(event.percentage).toBe(index.percentageFromLocation(event.index));
    expect(Object.isFrozen(event)).toBe(true);
    events.push('changed');
  });
  index.once('restored', (entries) => {
    expect(entries).toBe(index.entries);
    events.push('restored');
  });
  index.on('destroyed', () => events.push('destroyed'));
  await index.generate({ breakSize: 3 });
  index.setCurrent(1);
  index.setCurrent(1);
  const saved = index.save();
  index.load(saved);
  index.load(saved);
  index.destroy();
  index.destroy();
  expect(events).toEqual(['generated', 'changed', 'restored', 'destroyed']);
  expect(() => index.once('generated', () => {})).toThrow('destroyed');
});

test('generation errors preserve identity and cancellation does not publish an operational failure', async () => {
  const failure = new Error('original loader failure');
  const index = new Locations(publication(), () => Promise.reject(failure));
  const errors: unknown[] = [];
  index.on('error', (error) => errors.push(error));
  await expect(index.generate()).rejects.toBe(failure);
  expect(errors).toEqual([failure]);
  const controller = new AbortController();
  controller.abort();
  await expect(index.generate({ signal: controller.signal })).rejects.toThrow();
  expect(errors).toEqual([failure]);
  index.destroy();
});

test('a throwing final subscriber cannot retain headless resources or allow future subscriptions', async () => {
  const book = await Book.open(bookZip(bookFiles()));
  book.locations.on('destroyed', () => {
    throw new Error('location subscriber');
  });
  book.on('destroyed', () => {
    throw new Error('book subscriber');
  });
  const section = book.section();
  expect(() => book.destroy()).toThrow(AggregateError);
  await expect(section?.load()).rejects.toThrow('destroyed');
  expect(() => book.on('resourceLoaded', () => {})).toThrow('destroyed');
  expect(() => book.locations.on('generated', () => {})).toThrow('destroyed');
  book.destroy();
});
