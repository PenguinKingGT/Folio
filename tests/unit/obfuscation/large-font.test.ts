/** Large-font restoration must preserve immutable bytes without JavaScript iteration over the unchanged tail. */
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { restoreIdpfFont } from '../../../src/obfuscation/idpf';
import { identifierKey } from './fixture';

/** Hash native typed-array bytes without introducing a JavaScript loop over the large fixture. */
function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

test('bounds generic byte iteration for a 20 MiB font while preserving the source and full tail', () => {
  const font = new Uint8Array(20 * 1024 * 1024).fill(0x5a);
  const original = hash(font);
  const tail = hash(font.subarray(1040));
  const values = font.values.bind(font);
  let visited = 0;
  // Transparently observe generic iteration; the underlying byte values and restoration logic remain real.
  Object.defineProperty(font, Symbol.iterator, {
    value: function* () {
      for (const byte of values()) {
        visited++;
        yield byte;
      }
    },
  });
  const restored = restoreIdpfFont(font, identifierKey);
  expect(visited).toBeLessThanOrEqual(1040);
  expect(restored.length).toBe(font.length);
  expect(restored.buffer).not.toBe(font.buffer);
  expect(restored[0]).toBe(0x5a ^ 86);
  expect(restored[1039]).toBe(0x5a ^ 204);
  expect(hash(restored.subarray(1040))).toBe(tail);
  expect(hash(font)).toBe(original);
});

test('copies only the supplied font view and leaves surrounding storage unchanged', () => {
  const storage = new Uint8Array(1100).fill(0x5a);
  const original = hash(storage);
  const restored = restoreIdpfFont(storage.subarray(20, 1070), identifierKey);
  expect(restored.length).toBe(1050);
  expect(restored[0]).toBe(0x5a ^ 86);
  expect(restored[1039]).toBe(0x5a ^ 204);
  expect(restored[1040]).toBe(0x5a);
  expect(restored.at(-1)).toBe(0x5a);
  expect(hash(storage)).toBe(original);
});
