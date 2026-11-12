/** Parse OCF metadata with explicit namespace, resource-type, and container traversal boundaries. */
import { expect, test } from 'vitest';
import { parsePackage } from '../../../src/package/package';
import { obfuscatedFonts } from '../../../src/obfuscation/metadata';
import { opf } from '../package/fixture';
import { encryption } from './fixture';

/** Parse a package with one local declared font and one non-font resource. */
function publication(type = 'font/ttf', href = 'fonts/original%20wide.ttf') {
  return parsePackage(
    opf({
      manifest: `<item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="font" href="${href}" media-type="${type}"/>`,
    }),
  );
}

/** Decode only namespace-correct IDPF records against the OPF's actual path. */
function targets(source: string): ReadonlySet<string> {
  return obfuscatedFonts(source, publication(), 'OPS/package.opf');
}

test.each([
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/vnd.ms-opentype',
  'application/font-sfnt',
  'application/font-woff',
])('accepts declared font MIME type %s using container-root URI resolution', (type) => {
  expect([...obfuscatedFonts(encryption(), publication(type), 'OPS/package.opf')]).toEqual([
    'OPS/fonts/original wide.ttf',
  ]);
});

test('normalizes safe dot segments and alternate XML prefixes', () => {
  expect([
    ...targets(
      encryption('OPS/./fonts/../fonts/original%20wide.ttf')
        .replaceAll('enc:', 'x:')
        .replace('xmlns:enc=', 'xmlns:x='),
    ),
  ]).toEqual(['OPS/fonts/original wide.ttf']);
});

test.each([
  '<root/>',
  encryption().replaceAll('urn:oasis:names:tc:opendocument:xmlns:container', 'other'),
  '<!DOCTYPE encryption [<!ENTITY a "x">]><encryption/>',
  '<encryption>',
])('rejects invalid or unsafe metadata', (source) => {
  expect(() => targets(source)).toThrow();
});

test.each([
  '../escape.ttf',
  '/OPS/font.ttf',
  'https://remote.invalid/font.ttf',
  'data:font/ttf;base64,AA==',
  '#font',
  'OPS/fonts/original%20wide.ttf#part',
  'OPS/fonts/original%20wide.ttf?q=1',
  'OPS%2Ffonts/original.ttf',
  'OPS/fonts/missing.ttf',
  'OPS/chapter.xhtml',
])('rejects unsafe, ambiguous or undeclared font target %s', (uri) => {
  expect(() => targets(encryption(uri))).toThrow();
});

test.each([
  encryption().replace('<enc:CipherData>', '<enc:CipherData/><enc:CipherData>'),
  encryption().replace(' URI="OPS/fonts/original%20wide.ttf"', ''),
  encryption().replace(
    '<enc:CipherReference',
    '<enc:CipherReference URI="other"/><enc:CipherReference',
  ),
  encryption().replace('<enc:EncryptionMethod ', '<enc:EncryptionMethod/><enc:EncryptionMethod '),
])('rejects ambiguous or incomplete recognized records', (source) => {
  expect(() => targets(source)).toThrow();
});

test('does not infer a font from its filename or permit remote manifest targets', () => {
  expect(() => obfuscatedFonts(encryption(), publication('text/plain'), 'OPS/package.opf')).toThrow(
    'manifest font',
  );
  expect(() =>
    obfuscatedFonts(
      encryption(),
      publication('font/ttf', 'https://remote.invalid/font.ttf'),
      'OPS/package.opf',
    ),
  ).toThrow('manifest font');
});

test('does not apply IDPF decoding to unknown algorithms or foreign-namespace records', () => {
  expect(targets(encryption(undefined, 'urn:unsupported'))).toEqual(new Set());
  expect(targets(encryption().replaceAll('http://www.w3.org/2001/04/xmlenc#', 'other'))).toEqual(
    new Set(),
  );
});

test('rejects duplicate records after normalizing their container paths', () => {
  const source = encryption();
  const record = source.slice(
    source.indexOf('<enc:EncryptedData>'),
    source.indexOf('</encryption>'),
  );
  expect(() => targets(source.replace('</encryption>', record + '</encryption>'))).toThrow(
    'distinct',
  );
});
