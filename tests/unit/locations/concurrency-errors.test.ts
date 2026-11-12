/** Failure of any prefetched chapter must cancel siblings promptly and leave completed indexes intact. */
import { expect, test } from 'vitest';
import { Locations } from '../../../src/index';
import { chapter, publication } from './fixture';
import { deferred, nextTurn } from '../lifecycle/fixture';

test('a later read failure cancels an earlier noncooperative producer and preserves the previous index', async () => {
  let failing = false;
  const held = deferred<string>();
  const failure = new Error('Original second chapter failure');
  const signals: AbortSignal[] = [];
  const index = new Locations(publication(), (href, signal) => {
    if (!failing) {
      return Promise.resolve(chapter('<p>Original complete text</p>'));
    }
    signals.push(signal);
    return href === 'a.xhtml' ? held.promise : Promise.reject(failure);
  });
  await index.generate();
  const previous = index.entries;
  failing = true;
  try {
    await expect(index.generate({ concurrency: 2 })).rejects.toBe(failure);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(index.entries).toBe(previous);
    expect(index.state).toBe('ready');
  } finally {
    held.resolve(chapter('<p>Late</p>'));
    index.destroy();
  }
});

test('a parser failure cancels pending prefetched work without consuming or publishing it', async () => {
  const held = deferred<string>();
  let later: AbortSignal | undefined;
  const index = new Locations(publication(), (href, signal) => {
    if (href === 'a.xhtml') {
      return Promise.resolve('<html>malformed');
    }
    later = signal;
    return held.promise;
  });
  try {
    await expect(index.generate({ concurrency: 2 })).rejects.toThrow('XML');
    expect(later?.aborted).toBe(true);
    expect(index.entries).toEqual([]);
  } finally {
    held.resolve(chapter('<p>Late</p>'));
    index.destroy();
  }
});

test('caller cancellation stops all consumers before their shared producers finish', async () => {
  const held = deferred<string>();
  const signals: AbortSignal[] = [];
  const index = new Locations(publication(), (_href, signal) => {
    signals.push(signal);
    return held.promise;
  });
  const controller = new AbortController();
  const operation = index.generate({ concurrency: 2, signal: controller.signal });
  const rejected = expect(operation).rejects.toThrow();
  try {
    await nextTurn();
    controller.abort();
    await rejected;
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(index.state).toBe('empty');
  } finally {
    controller.abort();
    held.resolve(chapter('<p>Late</p>'));
    await rejected;
    index.destroy();
  }
});
