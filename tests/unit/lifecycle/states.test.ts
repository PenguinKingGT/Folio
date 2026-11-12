/** Public lifetime states reflect real lazy ownership and retain valid data across failures and cancellation. */
import { expect, test } from 'vitest';
import { Book, Locations, Spine, parsePackage } from '../../../src/index';
import { bookFiles, bookZip } from '../book/fixture';
import { chapter, locations, publication } from '../locations/fixture';
import { deferred } from './fixture';

test('section states follow shared loading, consumer cancellation, unloading, failure retry and destruction', async () => {
  const producer = deferred<string>();
  const started = deferred<void>();
  let calls = 0;
  const spine = new Spine(parsePackage(bookFiles().get('OPS/package.opf') ?? ''), () => {
    calls += 1;
    if (calls === 2) {
      return Promise.reject(new Error('Original load failure'));
    }
    if (calls > 2) {
      return Promise.resolve(chapter('<p>Fresh</p>'));
    }
    started.resolve();
    return producer.promise;
  });
  const section = spine.get();
  if (!section) {
    throw new Error('Missing lifecycle section.');
  }
  expect(section.state).toBe('unloaded');
  const controller = new AbortController();
  const cancelled = expect(section.load(controller.signal)).rejects.toThrow();
  const active = section.load();
  await started.promise;
  expect(section.state).toBe('loading');
  controller.abort();
  await cancelled;
  expect(section.state).toBe('loading');
  producer.resolve(chapter('<p>Original</p>'));
  await active;
  expect(section.state).toBe('loaded');
  section.unload();
  expect(section.state).toBe('unloaded');
  await expect(section.load()).rejects.toThrow('Original');
  expect(section.state).toBe('unloaded');
  await section.load();
  expect(section.state).toBe('loaded');
  spine.destroy();
  expect(section.state).toBe('destroyed');
});

test('book states expose closing synchronously and remain readable after source cleanup', async () => {
  const book = await Book.open(bookZip());
  expect(book.state).toBe('open');
  const section = book.section();
  const closing = book.destroyAsync();
  expect(book.state).toBe('closing');
  expect(book.destroyAsync()).toBe(closing);
  await closing;
  expect(book.state).toBe('destroyed');
  expect(section?.state).toBe('destroyed');
  book.destroy();
  expect(book.state).toBe('destroyed');
});

test('location states preserve a generated snapshot across failure and reset after restore/destruction', async () => {
  const index = locations();
  expect(index.state).toBe('empty');
  const generated = index.generate({ breakSize: 3 });
  expect(index.state).toBe('generating');
  await generated;
  expect(index.state).toBe('ready');
  const saved = index.save();
  await expect(index.generate({ breakSize: 0 })).rejects.toThrow();
  expect(index.state).toBe('ready');
  index.load(saved);
  expect(index.state).toBe('ready');
  index.destroy();
  expect(index.state).toBe('destroyed');
});

test('a superseded location generation cannot clear the current producer state or replace its result', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const begunFirst = deferred<void>();
  const begunSecond = deferred<void>();
  let calls = 0;
  const index = new Locations(publication(), () => {
    calls += 1;
    if (calls === 1) {
      begunFirst.resolve();
      return first.promise;
    }
    if (calls === 2) {
      begunSecond.resolve();
      return second.promise;
    }
    return Promise.resolve(chapter('<p>Remaining text</p>'));
  });
  const rejected = expect(index.generate()).rejects.toThrow();
  await begunFirst.promise;
  const current = index.generate();
  await begunSecond.promise;
  await rejected;
  expect(index.state).toBe('generating');
  first.resolve(chapter('<p>Obsolete</p>'));
  second.resolve(chapter('<p>Fresh reading units</p>'));
  await current;
  expect(index.state).toBe('ready');
  index.destroy();
});

test('restore during generation immediately reports the restored snapshot state and cancels old work', async () => {
  const original = locations();
  await original.generate({ breakSize: 3 });
  const saved = original.save();
  original.destroy();
  const held = deferred<string>();
  const started = deferred<void>();
  const index = new Locations(publication(), () => {
    started.resolve();
    return held.promise;
  });
  const rejected = expect(index.generate()).rejects.toThrow();
  await started.promise;
  index.load(saved);
  expect(index.state).toBe('ready');
  await rejected;
  held.resolve(chapter('<p>Obsolete</p>'));
  expect(index.save()).toBe(saved);
  index.destroy();
});
