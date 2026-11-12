/** Shared resource producers retain independent consumer cancellation and never resurrect invalidated URL ownership. */
import { expect, test } from 'vitest';
import { Cover, Resources, parsePackage } from '../../../src/index';
import { bookFiles } from '../book/fixture';
import { deferred, nextTurn } from './fixture';

test('concurrent resource URLs share byte I/O while one cancelled consumer leaves the producer alive', async () => {
  const publication = parsePackage(bookFiles().get('OPS/package.opf') ?? '');
  const producer = deferred<Uint8Array>();
  const started = deferred<void>();
  let calls = 0;
  let owner: AbortSignal | undefined;
  const resources = new Resources(publication, 'OPS/package.opf', (_path, signal) => {
    owner = signal;
    calls += 1;
    started.resolve();
    return producer.promise;
  });
  const controller = new AbortController();
  const rejected = expect(
    resources.url('images/cover.jpg#a', 'OPS/package.opf', controller.signal),
  ).rejects.toThrow();
  const active = resources.url('images/cover.jpg#b');
  try {
    await started.promise;
    controller.abort();
    await rejected;
    expect(owner?.aborted).toBe(false);
    expect(calls).toBe(1);
    producer.resolve(new TextEncoder().encode('Original bytes'));
    const value = await active;
    expect(value.endsWith('#b')).toBe(true);
    const base = value.split('#')[0] ?? '';
    expect(await (await fetch(base)).text()).toBe('Original bytes');
    expect(await resources.url('images/cover.jpg#c')).toBe(`${base}#c`);
    resources.destroy();
    await expect(fetch(base)).rejects.toThrow();
  } finally {
    producer.resolve(new Uint8Array());
    resources.destroy();
  }
});

test('concurrent cyclic CSS traversals reject independently instead of deadlocking shared transform promises', async () => {
  const publication = parsePackage(bookFiles().get('OPS/package.opf') ?? '');
  const resources = new Resources(publication, 'OPS/package.opf', (path) =>
    Promise.resolve(
      new TextEncoder().encode(path.endsWith('a.css') ? '@import "b.css";' : '@import "a.css";'),
    ),
  );
  try {
    const results = await Promise.allSettled([resources.url('a.css'), resources.url('b.css')]);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
  } finally {
    resources.destroy();
  }
});

test('failed byte I/O can retry and revoked cover producers cannot replace a newer cached URL', async () => {
  const publication = parsePackage(bookFiles().get('OPS/package.opf') ?? '');
  let calls = 0;
  const resources = new Resources(publication, 'OPS/package.opf', () => {
    calls += 1;
    return calls === 1
      ? Promise.reject(new Error('Original read'))
      : Promise.resolve(new Uint8Array([1]));
  });
  const held = deferred<Blob>();
  const started = deferred<void>();
  let covers = 0;
  const cover = new Cover(publication, () => {
    covers += 1;
    if (covers > 1) {
      return Promise.resolve(new Blob(['Fresh cover']));
    }
    started.resolve();
    return held.promise;
  });
  try {
    await expect(resources.url('images/cover.jpg')).rejects.toThrow('Original read');
    expect(await resources.url('images/cover.jpg')).toMatch(/^blob:/);
    expect(calls).toBe(2);
    const rejected = expect(cover.url()).rejects.toThrow();
    await started.promise;
    cover.revokeUrl();
    await rejected;
    const fresh = await cover.url();
    expect(fresh).not.toBeNull();
    held.resolve(new Blob(['Obsolete cover']));
    await nextTurn();
    expect(await cover.url()).toBe(fresh);
    expect(await (await fetch(fresh ?? '')).text()).toBe('Fresh cover');
  } finally {
    held.resolve(new Blob());
    cover.destroy();
    resources.destroy();
  }
});
