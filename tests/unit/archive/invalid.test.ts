/** Original malformed ZIP fixtures verify rejection before exposing ambiguous resources. */
import { strToU8, zipSync } from 'fflate';
import { expect, test } from 'vitest';
import { Archive } from '../../../src/index';

test('rejects duplicate names in the central directory', () => {
  const bytes = zipSync({ a: strToU8('one'), b: strToU8('two') });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset < bytes.length - 46; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      bytes[offset + 46] = 97;
    }
  }
  expect(() => new Archive(bytes)).toThrow('Duplicate archive entry');
});

test('rejects directory entries containing hidden resource data', () => {
  const bytes = zipSync({ 'OPS/': strToU8('unexpected') });
  expect(() => new Archive(bytes)).toThrow('size declarations');
});
