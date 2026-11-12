/** Compare standard key derivation and prefix restoration with independent cryptographic and byte vectors. */
import { createHash } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';
import { idpfKey, restoreIdpfFont } from '../../../src/obfuscation/idpf';
import { opf, metadata } from '../package/fixture';
import { encodedFont, identifierKey } from './fixture';

/** Restore host crypto capabilities after testing unsupported environments. */
afterEach(() => vi.unstubAllGlobals());

test.each(['urn:folio:test', ' a\t b\r\nc ', '\u00a0abc\u00a0', 'αβ😀'])(
  'derives SHA-1 from XML-normalized UTF-8 identifier %s',
  async (identifier) => {
    const source = opf({ metadata: metadata.replace('urn:folio:test', identifier) });
    const expected = createHash('sha1')
      .update(identifier.replace(/[\u0020\t\r\n]/g, ''))
      .digest();
    expect(await idpfKey(source)).toEqual(Uint8Array.from(expected));
  },
);

test('uses the referenced direct identifier, not a different first Dublin Core value or Unicode trim', async () => {
  const source = opf({
    metadata:
      '<dc:identifier id="other">wrong</dc:identifier>' +
      metadata.replace('urn:folio:test', '\u00a0urn:folio:test\u00a0'),
  });
  expect(await idpfKey(source)).toEqual(
    Uint8Array.from(createHash('sha1').update('\u00a0urn:folio:test\u00a0').digest()),
  );
});

test.each([
  '<root/>',
  '<root xmlns="http://www.idpf.org/2007/opf"/>',
  '<package xmlns="http://www.idpf.org/2007/opf"/>',
  opf({ metadata: metadata.replace('id="uid"', 'id="other"') }),
  opf({ metadata: metadata.replace('urn:folio:test', ' \t\n') }),
])('rejects an unresolved or empty obfuscation identifier', async (source) => {
  await expect(idpfKey(source)).rejects.toThrow('unique identifier');
});

test('rejects unavailable Web Crypto without changing unrelated book loading', async () => {
  vi.stubGlobal('crypto', undefined);
  await expect(idpfKey(opf())).rejects.toThrow('Web Crypto');
  vi.stubGlobal('crypto', {});
  await expect(idpfKey(opf())).rejects.toThrow('Web Crypto');
});

test.each([0, 1, 19, 20, 21, 1039, 1040, 1041, 4096])(
  'restores exactly the permitted prefix for %i bytes without changing input',
  (length) => {
    const original = Uint8Array.from({ length }, (_, index) => index % 251);
    const encoded = encodedFont(original, identifierKey);
    const buffer = new Uint8Array(identifierKey.length + 8);
    buffer.set(identifierKey, 4);
    const restored = restoreIdpfFont(encoded, buffer.subarray(4, 24));
    expect(restored).toEqual(original);
    expect(restored).not.toBe(encoded);
    expect(encoded).toEqual(encodedFont(original, identifierKey));
    expect(restored.subarray(1040)).toEqual(encoded.subarray(1040));
  },
);

test.each([0, 19, 21])('rejects a %i-byte key before changing input', (length) => {
  expect(() => restoreIdpfFont(new Uint8Array(4), new Uint8Array(length))).toThrow('20 bytes');
});

test('reads package metadata directly instead of unrelated nested OPF metadata', async () => {
  const source = opf().replace(
    '<metadata>',
    '<collection><metadata><dc:identifier id="nested">Other identifier</dc:identifier></metadata></collection><metadata>',
  );
  expect(await idpfKey(source)).toEqual(identifierKey);
});
