/** Bounded concurrency limits buffered as well as outstanding work and preserves serial sampling semantics. */
import { expect, test } from 'vitest';
import { Locations } from '../../../src/index';
import { chapter, locations } from './fixture';
import { manyPublication } from './concurrency-fixture';
import { deferred, nextTurn } from '../lifecycle/fixture';

for (const concurrency of [undefined, 1, 2, 4, 16]) {
  test(`limits the read window to ${concurrency ?? 'default 4'} even when later loads finish first`, async () => {
    const gates = Array.from({ length: 20 }, () => deferred<string>());
    let calls = 0;
    const index = new Locations(manyPublication(20), () => {
      const producer = gates[calls++];
      if (!producer) {
        throw new Error('Unexpected extra load.');
      }
      return producer.promise;
    });
    const pending = index.generate(concurrency === undefined ? {} : { concurrency });
    const limit = concurrency ?? 4;
    try {
      await nextTurn();
      expect(calls).toBe(limit);
      gates[1]?.resolve(chapter('<p>Second ready first</p>'));
      await nextTurn();
      expect(calls).toBe(limit);
      expect(index.length).toBe(0);
    } finally {
      for (const gate of gates) {
        gate.resolve(chapter('<p>Original text</p>'));
      }
      await pending;
      index.destroy();
    }
  });
}

for (const unit of ['characters', 'words'] as const) {
  test(`parallel ${unit} samples and totals equal serial output across inline Unicode text`, async () => {
    const first = '<p>Original 😀 <em>cross node</em> text.</p>';
    const second = '<p>Other words 中文 text.</p>';
    const serial = locations(first, second);
    const parallel = locations(first, second);
    try {
      const expected = await serial.generate({ unit, breakSize: 2, concurrency: 1 });
      expect(await parallel.generate({ unit, breakSize: 2, concurrency: 2 })).toEqual(expected);
      expect(parallel.total).toBe(serial.total);
    } finally {
      serial.destroy();
      parallel.destroy();
    }
  });
}

test.each([0, -1, 1.5, 17, Infinity, NaN])(
  'rejects invalid concurrency %s before any chapter I/O',
  async (concurrency) => {
    let reads = 0;
    const index = new Locations(manyPublication(2), () => {
      reads++;
      return Promise.resolve(chapter('<p>Text</p>'));
    });
    await expect(index.generate({ concurrency })).rejects.toThrow(RangeError);
    expect(reads).toBe(0);
    index.destroy();
  },
);
