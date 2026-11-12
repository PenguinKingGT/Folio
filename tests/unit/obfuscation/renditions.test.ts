/** Container-wide font declarations must not prevent reading the selected OPF rendition. */
import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { afterEach, expect, test, vi } from 'vitest';
import { Book } from '../../../src/index';
import { bookFiles } from '../book/fixture';
import { encodedFont, encryption, identifierKey } from './fixture';

const alternateFont = encodedFont(
  new Uint8Array([31, 32, 33]),
  createHash('sha1').update('urn:folio:alternate').digest(),
);

/** Restore host capabilities after proving unused font declarations need no digest. */
afterEach(() => vi.unstubAllGlobals());

/** Author two OPFs with different identifiers and separate font ownership. */
function renditionZip(selectedFont = false): Uint8Array<ArrayBuffer> {
  const files = bookFiles();
  for (const [path, source] of bookFiles()) {
    if (path.startsWith('OPS/')) {
      files.set('ALT/' + path.slice(4), source);
    }
  }
  const primary = files.get('OPS/package.opf') ?? '';
  const font = '<item id="font" href="fonts/wide.ttf" media-type="font/ttf"/>';
  files.set(
    'ALT/package.opf',
    primary
      .replace('urn:folio:test', 'urn:folio:alternate')
      .replace('</manifest>', font + '</manifest>'),
  );
  files.set(
    'META-INF/container.xml',
    (files.get('META-INF/container.xml') ?? '').replace(
      '</rootfiles>',
      '<rootfile full-path="ALT/package.opf" media-type="application/oebps-package+xml"/></rootfiles>',
    ),
  );
  const otherRecord = encryption('ALT/fonts/wide.ttf');
  let records = otherRecord;
  if (selectedFont) {
    files.set('OPS/package.opf', primary.replace('</manifest>', font + '</manifest>'));
    records = encryption('OPS/fonts/wide.ttf').replace(
      '</encryption>',
      otherRecord.slice(
        otherRecord.indexOf('<enc:EncryptedData>'),
        otherRecord.indexOf('</encryption>'),
      ) + '</encryption>',
    );
  }
  files.set('META-INF/encryption.xml', records);
  const entries = Object.fromEntries([...files].map(([path, source]) => [path, strToU8(source)]));
  entries['ALT/fonts/wide.ttf'] = Uint8Array.from(alternateFont);
  if (selectedFont) {
    entries['OPS/fonts/wide.ttf'] = encodedFont(new Uint8Array([0, 1, 2]), identifierKey);
  }
  return zipSync(entries, { level: 0 });
}

test('opens and reads the selected rendition when only another rendition declares obfuscated fonts', async () => {
  vi.stubGlobal('crypto', undefined);
  const publication = await Book.open(renditionZip());
  try {
    expect(publication.packagePath).toBe('OPS/package.opf');
    expect(await publication.section(0)?.render()).toContain('Original chapter text');
    expect(await publication.bytes('../ALT/fonts/wide.ttf')).toEqual(alternateFont);
  } finally {
    publication.destroy();
  }
});

test('decodes selected fonts without applying the selected key to another rendition', async () => {
  const publication = await Book.open(renditionZip(true));
  try {
    expect(await publication.bytes('fonts/wide.ttf')).toEqual(new Uint8Array([0, 1, 2]));
    expect(await publication.bytes('../ALT/fonts/wide.ttf')).toEqual(alternateFont);
  } finally {
    publication.destroy();
  }
});
