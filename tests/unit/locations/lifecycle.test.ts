/** Generation failure, cancellation, concurrency and cleanup must not publish partial indexes. */
import { expect, test } from 'vitest';
import { Locations } from '../../../src/index';
import { lowerBound } from '../../../src/locations/search';
import { withAbort } from '../../../src/async/cancellation';
import { gate } from '../extensions/fixture';
import { chapter, locations, publication } from './fixture';

test('binary search handles boundaries and refuses sparse data instead of looping', () => {
  expect(lowerBound([1, 3, 5], (value) => value >= 3)).toBe(1);
  expect(lowerBound([], () => true)).toBe(0);
  expect(lowerBound([1], (value) => value >= 2)).toBe(1);
  const sparse: number[] = [];
  sparse.length = 1;
  expect(() => lowerBound(sparse, () => true)).toThrow('Sparse');
});

test('cancelled and failed generations retain the previous table', async () => {
  let fail = false;
  const index = new Locations(publication(), () =>
    fail ? Promise.reject(new Error('read failed')) : Promise.resolve(chapter('<p>Original</p>')),
  );
  await index.generate();
  const previous = index.entries;
  fail = true;
  await expect(index.generate()).rejects.toThrow('read failed');
  expect(index.entries).toBe(previous);
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(index.generate({ signal: cancelled.signal })).rejects.toThrow();
  expect(index.entries).toBe(previous);
  index.destroy();
  index.destroy();
  expect(index.entries).toEqual([]);
  expect(() => index.save()).toThrow('destroyed');
  expect(() => index.load({})).toThrow('destroyed');
});

test('a newer generation supersedes an older ignored-cancellation producer', async () => {
  let finish: ((value: string) => void) | undefined;
  let reads = 0;
  const started = gate();
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const index = new Locations(publication(), () => {
    reads += 1;
    started.release();
    return reads === 1 ? pending : Promise.resolve(chapter('<p>New content</p>'));
  });
  const older = index.generate();
  const rejected = expect(older).rejects.toThrow();
  await started.promise;
  await index.generate({ unit: 'words' });
  const current = index.entries;
  finish?.(chapter('<p>Old content</p>'));
  await rejected;
  expect(index.entries).toBe(current);
});

test('invalid generation options and inconsistent models reject explicitly', async () => {
  const index = locations();
  await expect(index.generate({ breakSize: Number.POSITIVE_INFINITY })).rejects.toThrow(RangeError);
  const invalid = new Locations({ ...publication(), manifest: new Map() }, () =>
    Promise.resolve(chapter('')),
  );
  await expect(invalid.generate()).rejects.toThrow('missing');
});

test('cancels promptly even when the custom producer ignores its signal', async () => {
  let finish: ((value: string) => void) | undefined;
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const index = new Locations(publication(), () => pending);
  const controller = new AbortController();
  const generating = index.generate({ signal: controller.signal });
  controller.abort();
  await expect(generating).rejects.toThrow();
  finish?.(chapter('<p>late response</p>'));
  expect(index.length).toBe(0);
});

test('pre-cancelled waits still consume producer failures without unhandled rejections', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    withAbort(Promise.reject(new Error('ignored producer failure')), controller.signal),
  ).rejects.toBe(controller.signal.reason);
});
