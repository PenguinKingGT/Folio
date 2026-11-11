/** Cover tests use original OPF fixtures and native Blob URL retrieval. */
import { expect, test } from 'vitest';
import { Cover, parsePackage } from '../../../src/index';
import { manifest, metadata, opf } from '../package/fixture';

test('loads, caches, types, revokes and recreates an EPUB 3 cover URL', async () => {
  let calls = 0;
  const cover = new Cover(parsePackage(opf()), (path) => {
    expect(path).toBe('images/cover.jpg');
    calls += 1;
    return Promise.resolve(new Blob(['image bytes']));
  });
  const [first, second] = await Promise.all([cover.url(), cover.url()]);
  if (first === null) {
    throw new Error('Expected a cover.');
  }
  expect(first).toBe(second);
  expect(await cover.url()).toBe(first);
  expect(calls).toBe(1);
  const response = await fetch(first);
  expect(response.headers.get('content-type')).toBe('image/jpeg');
  expect(await response.text()).toBe('image bytes');
  cover.revokeUrl();
  cover.revokeUrl();
  await expect(fetch(first)).rejects.toThrow();
  expect(await cover.url()).not.toBe(first);
  expect(calls).toBe(2);
  cover.destroy();
  cover.destroy();
  await expect(cover.url()).rejects.toThrow('destroyed');
});

test('loads an EPUB 2 cover and returns null without calling a loader for absent covers', async () => {
  const legacy = parsePackage(
    opf({
      attributes: 'version="2.0" unique-identifier="uid"',
      metadata: metadata + '<meta name="cover" content="cover"/>',
      manifest: manifest.replace(' properties="cover-image"', ''),
    }),
  );
  const cover = new Cover(legacy, () => Promise.resolve(new Blob(['legacy'])));
  expect(await cover.url()).toMatch(/^blob:/);
  cover.destroy();
  const missing = new Cover({ ...legacy, coverPath: null }, () => {
    throw new Error('Must not request absent covers.');
  });
  expect(await missing.url()).toBeNull();
});

test('retries a failed loader and cancels only the caller that aborts', async () => {
  const publication = parsePackage(opf());
  let attempts = 0;
  const cover = new Cover(publication, () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('network failed');
    }
    return Promise.resolve(new Blob(['loaded']));
  });
  await expect(cover.url()).rejects.toThrow('network failed');
  const controller = new AbortController();
  const cancelled = cover.url(controller.signal);
  const active = cover.url();
  controller.abort();
  await expect(cancelled).rejects.toThrow();
  expect(await active).toMatch(/^blob:/);
  await expect(cover.url(controller.signal)).rejects.toThrow();
  cover.destroy();
});

test('never publishes an in-flight cover after destruction', async () => {
  const controller = new AbortController();
  const cover = new Cover({ ...parsePackage(opf()), manifest: new Map() }, (_path, signal) => {
    expect(signal.aborted).toBe(true);
    controller.abort();
    return Promise.resolve(new Blob(['stale']));
  });
  const pending = cover.url();
  cover.destroy();
  await expect(pending).rejects.toThrow();
  expect(controller.signal.aborted).toBe(true);
});
