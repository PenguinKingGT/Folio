/** Measure actual public resource reads for a synthetic 20 MiB standard-obfuscated font. */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { strToU8, zipSync } from 'fflate';
import { Book } from '../../dist/folio.js';

const identifier = 'urn:folio:benchmark';
const key = createHash('sha1').update(identifier).digest();
const font = new Uint8Array(20 * 1024 * 1024);
for (let index = 0; index < 1040; index++) {
  font[index] = key.readUInt8(index % key.length);
}
const entries = {
  mimetype: strToU8('application/epub+zip'),
  'META-INF/container.xml': strToU8(
    '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  ),
  'META-INF/encryption.xml': strToU8(
    '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><enc:CipherData><enc:CipherReference URI="font.ttf"/></enc:CipherData></enc:EncryptedData></encryption>',
  ),
  'package.opf': strToU8(
    `<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="uid"><metadata><dc:identifier id="uid">${identifier}</dc:identifier><dc:title>Benchmark</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="font" href="font.ttf" media-type="font/ttf"/></manifest><spine><itemref idref="chapter"/></spine></package>`,
  ),
  'chapter.xhtml': strToU8(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>Original benchmark chapter</body></html>',
  ),
  'font.ttf': font,
};
const publication = await Book.open(zipSync(entries, { level: 0 }));
const durations = [];
try {
  for (let trial = 0; trial < 6; trial++) {
    const start = performance.now();
    const decoded = await publication.bytes('font.ttf');
    const elapsed = performance.now() - start;
    if (
      decoded.length !== font.length ||
      decoded.subarray(0, 1040).some((byte) => byte !== 0) ||
      decoded.at(-1) !== 0
    ) {
      throw new Error('Incorrect restored benchmark bytes.');
    }
    if (trial > 0) {
      durations.push(elapsed);
    }
  }
  durations.sort((left, right) => left - right);
  const median = durations[2];
  if (median === undefined) {
    throw new Error('No benchmark samples were collected.');
  }
  process.stdout.write(
    JSON.stringify({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      mib: 20,
      samplesMs: durations.map((value) => Number(value.toFixed(2))),
      medianMs: Number(median.toFixed(2)),
    }) + '\n',
  );
} finally {
  publication.destroy();
}
