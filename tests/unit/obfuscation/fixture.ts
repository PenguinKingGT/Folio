/** Author original ZIP publications with synthetic IDPF-obfuscated bytes, independent of production decoding. */
import { strToU8, zipSync } from 'fflate';
import { bookFiles } from '../book/fixture';

export const identifier = 'urn:folio:test';
// Independently generated with Node createHash('sha1').update(identifier); this is a fixed test vector.
export const identifierKey = Uint8Array.from([
  86, 158, 92, 70, 150, 155, 217, 68, 115, 242, 197, 130, 24, 0, 40, 194, 149, 152, 46, 204,
]);

/** Encode only the standard 1040-byte prefix using an independently supplied SHA-1 key. */
export function encodedFont(bytes: Uint8Array, key: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes, (byte, index) =>
    index < 1040 ? byte ^ (key[index % key.length] ?? 0) : byte,
  );
}

/** Wrap a root-relative URI in a prefixed OCF encryption record. */
export function encryption(
  uri = 'OPS/fonts/original%20wide.ttf',
  algorithm = 'http://www.idpf.org/2008/embedding',
): string {
  return `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:EncryptionMethod Algorithm="${algorithm}"/><enc:CipherData><enc:CipherReference URI="${uri}"/></enc:CipherData></enc:EncryptedData></encryption>`;
}

/** Store original container metadata and caller-supplied binary font bytes without changing the source buffer. */
export function fontZip(
  font: Uint8Array,
  xml: string | null = encryption(),
  id = identifier,
): Uint8Array<ArrayBuffer> {
  const files = bookFiles();
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '')
      .replace('urn:folio:test', id)
      .replace(
        '</manifest>',
        '<item id="font" href="fonts/original%20wide.ttf" media-type="font/ttf"/></manifest>',
      ),
  );
  if (xml !== null) {
    files.set('META-INF/encryption.xml', xml);
  }
  files.set(
    'OPS/text/chapter one.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><style>@font-face{font-family:FolioObfuscated;src:url(../fonts/original%20wide.ttf)}span{font:20px FolioObfuscated}</style></head><body><span id="sample">AAAA</span></body></html>',
  );
  const bytes = Object.fromEntries([...files].map(([name, value]) => [name, strToU8(value)]));
  bytes['OPS/fonts/original wide.ttf'] = Uint8Array.from(font);
  return zipSync(bytes, { level: 0 });
}
