/** Verify optional metadata discovery, shared source ownership, and deterministic read cancellation. */
import { expect, test } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import { Book } from '../../../src/index';
import { openSource } from '../../../src/book/source';
import { fontSource } from '../../../src/book/font-source';
import { parsePackage } from '../../../src/package/package';
import { encodedFont, encryption, fontZip, identifierKey } from './fixture';

const plain = Uint8Array.from({ length: 1050 }, (_, index) => index % 251);
const encoded = encodedFont(plain, identifierKey);

/** Hold a genuine source read independently of its abort signal to expose consumer lifetime behavior. */
function gate() {
  let release: ((bytes: Uint8Array) => void) | undefined;
  const pending = new Promise<Uint8Array>((resolve) => {
    release = resolve;
  });
  return { pending, release: (bytes: Uint8Array) => release?.(bytes) };
}

test('preserves unrelated bytes and leaves unknown algorithms untouched', async () => {
  const publication = await Book.open(fontZip(encoded, encryption(undefined, 'urn:unsupported')));
  try {
    expect(await publication.bytes('fonts/original%20wide.ttf')).toEqual(encoded);
    expect(await publication.text('images/cover.jpg')).toBe('original cover bytes');
  } finally {
    publication.destroy();
  }
});

test('rejects malformed encryption documents and invalid UTF-8 during opening', async () => {
  await expect(Book.open(fontZip(encoded, '<root/>'))).rejects.toThrow('OCF encryption');
  const entries = unzipSync(fontZip(encoded));
  entries['META-INF/encryption.xml'] = new Uint8Array([0xff]);
  await expect(Book.open(zipSync(entries, { level: 0 }))).rejects.toThrow();
});

test('cancels an uncooperative metadata read without waiting for its producer', async () => {
  const source = await openSource(fontZip(encoded), {});
  const held = gate();
  const decorated = { ...source, read: () => held.pending };
  const pending = fontSource(decorated, parsePackage(source.package.source));
  const rejected = expect(pending).rejects.toThrow();
  source.destroy();
  await rejected;
  held.release(new TextEncoder().encode(encryption()));
});

test('one cancelled font consumer does not corrupt a later decoded read', async () => {
  const source = await openSource(fontZip(encoded), {});
  const held = gate();
  let calls = 0;
  const decorated = {
    ...source,
    read: (path: string, signal: AbortSignal) => {
      if (path.endsWith('.ttf') && calls++ === 0) {
        return held.pending;
      }
      return source.read(path, signal);
    },
  };
  try {
    const decoded = await fontSource(decorated, parsePackage(source.package.source));
    const aborted = new AbortController();
    aborted.abort();
    await expect(decoded.read('OPS/fonts/original wide.ttf', aborted.signal)).rejects.toThrow();
    expect(calls).toBe(0);
    const controller = new AbortController();
    const pending = decoded.read('OPS/fonts/original wide.ttf', controller.signal);
    const rejected = expect(pending).rejects.toThrow();
    controller.abort();
    await rejected;
    held.release(encoded);
    expect(await decoded.read('OPS/fonts/original wide.ttf', source.signal)).toEqual(plain);
    expect(await decoded.read('OPS/images/cover.jpg', source.signal)).toEqual(
      new TextEncoder().encode('original cover bytes'),
    );
  } finally {
    source.destroy();
  }
});

test('destroying the source cancels a font consumer even when its own signal stays active', async () => {
  const source = await openSource(fontZip(encoded), {});
  const held = gate();
  const decorated = {
    ...source,
    read: (path: string, signal: AbortSignal) =>
      path.endsWith('.ttf') ? held.pending : source.read(path, signal),
  };
  const decoded = await fontSource(decorated, parsePackage(source.package.source));
  const pending = decoded.read('OPS/fonts/original wide.ttf', new AbortController().signal);
  const rejected = expect(pending).rejects.toThrow();
  source.destroy();
  await rejected;
  held.release(encoded);
});
