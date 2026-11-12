/** Real lazy sections apply asynchronous XML and serialization extensions without stale-generation publication. */
import { expect, test } from 'vitest';
import { searchBook } from '../search/fixture';
import { gate } from './fixture';

test('content hooks mutate the cached headless DOM once per load and serialization runs for every render', async () => {
  const book = await searchBook();
  let loaded = 0;
  const serialized: number[] = [];
  book.hooks.content.register(async ({ document }) => {
    await Promise.resolve();
    loaded += 1;
    document.getElementById('phrase')?.setAttribute('data-extension', 'original');
  });
  book.hooks.serialize.register(async (context) => {
    await Promise.resolve();
    serialized.push(context.section.index);
    context.source = context.source.replace('Alpha', 'Extension');
  });
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing extension section.');
    }
    const [first, second] = await Promise.all([section.render(), section.render()]);
    expect(first).toContain('data-extension="original"');
    expect(second).toContain('Extension');
    expect(loaded).toBe(1);
    expect(serialized).toEqual([0, 0]);
    expect(await section.search('Alpha original')).toHaveLength(1);
    expect(await section.search('Extension original')).toHaveLength(0);
    section.unload();
    await section.render();
    expect(loaded).toBe(2);
  } finally {
    book.destroy();
  }
});

test('content failures do not cache partial DOMs and removing the failing hook permits retry', async () => {
  const book = await searchBook();
  const failure = new Error('content extension');
  const remove = book.hooks.content.register(() => {
    throw failure;
  });
  try {
    await expect(book.section()?.load()).rejects.toBe(failure);
    remove();
    expect(await book.section()?.search('original text')).toHaveLength(1);
  } finally {
    book.destroy();
  }
});

test('unload cancels asynchronous serialization and prevents later hooks from publishing stale output', async () => {
  const book = await searchBook();
  const started = gate();
  const waiting = gate();
  const remove = book.hooks.serialize.register(async () => {
    started.release();
    await waiting.promise;
  });
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing cancellable section.');
    }
    const rejected = expect(section.render()).rejects.toThrow();
    await started.promise;
    section.unload();
    await rejected;
    remove();
    waiting.release();
    expect(await section.render()).toContain('Alpha');
  } finally {
    waiting.release();
    book.destroy();
  }
});

test('validates final serialization hook output at the public runtime boundary', async () => {
  const book = await searchBook();
  book.hooks.serialize.register((context) => {
    Reflect.set(context, 'source', 42);
  });
  try {
    await expect(book.section()?.render()).rejects.toThrow('string');
  } finally {
    book.destroy();
  }
});

test('unload cancels an uncooperative content hook and a fresh generation remains independently loadable', async () => {
  const book = await searchBook();
  const started = gate();
  const waiting = gate();
  const remove = book.hooks.content.register(async ({ document }) => {
    document.getElementById('phrase')?.setAttribute('data-stale', 'old');
    started.release();
    await waiting.promise;
  });
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing generation hook chapter.');
    }
    const rejected = expect(section.load()).rejects.toThrow();
    await started.promise;
    section.unload();
    await rejected;
    remove();
    const document = await section.load();
    waiting.release();
    expect(document.getElementById('phrase')?.hasAttribute('data-stale')).toBe(false);
    expect(await section.load()).toBe(document);
  } finally {
    waiting.release();
    book.destroy();
  }
});
