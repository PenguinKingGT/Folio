/** Verify namespace-independent EPUB 2/3 metadata, resources, and reading order. */
import { expect, test } from 'vitest';
import { parsePackage } from '../../../src/index';
import { manifest, metadata, opf } from './fixture';

test('parses EPUB 3 metadata, nav, cover and rendition properties', () => {
  const book = parsePackage(opf());
  expect(book.version).toBe('3.0');
  expect(book.metadata).toMatchObject({
    title: 'Original title',
    creators: ['First author', 'Second author'],
    language: 'en',
    identifier: 'urn:folio:test',
    publisher: '',
  });
  expect(book.metadata.entries).toContainEqual({
    name: 'role',
    value: 'aut',
    id: null,
    refines: '#creator',
  });
  expect(book.rendition).toEqual({ layout: 'pre-paginated' });
  expect(book.navPath).toBe('nav.xhtml');
  expect(book.coverPath).toBe('images/cover.jpg');
  expect(book.ncxPath).toBeNull();
  expect(book.direction).toBe('default');
  expect(book.spine).toEqual([{ index: 0, idref: 'chapter', linear: true, properties: [] }]);
});

test('preserves non-linear spine items, item properties and fallback references', () => {
  const xml = opf({
    manifest: `${manifest}<item id="svg" href="image.svg" media-type="image/svg+xml" fallback="chapter" media-overlay="overlay"/><item id="overlay" href="audio.smil" media-type="application/smil+xml"/>`,
    spine:
      '<itemref idref="chapter" linear="no" properties="rendition:layout-pre-paginated page-spread-left"/><itemref idref="svg"/>',
  });
  const book = parsePackage(xml);
  expect(book.direction).toBe('rtl');
  expect(book.spine[0]).toMatchObject({
    linear: false,
    properties: ['rendition:layout-pre-paginated', 'page-spread-left'],
  });
  expect(book.manifest.get('svg')).toMatchObject({ fallback: 'chapter', mediaOverlay: 'overlay' });
});

test('parses EPUB 2 NCX and legacy cover metadata', () => {
  const xml = opf({
    attributes: 'version="2.0" unique-identifier="uid"',
    metadata: metadata.replace(
      '<meta property="rendition:layout">pre-paginated</meta>',
      '<meta name="cover" content="cover"/>',
    ),
    manifest:
      manifest.replace(' properties="nav"', '').replace(' properties="cover-image"', '') +
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
  }).replace('<spine ', '<spine toc="ncx" ');
  const book = parsePackage(xml);
  expect(book.navPath).toBeNull();
  expect(book.ncxPath).toBe('toc.ncx');
  expect(book.coverPath).toBe('images/cover.jpg');
});

test('handles prefixed OPF elements and missing optional cover metadata', () => {
  const xml = opf({
    manifest: '<item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>',
  })
    .replaceAll('xmlns="http://www.idpf.org/2007/opf"', 'xmlns:o="http://www.idpf.org/2007/opf"')
    .replace(/<(\/?)(package|metadata|manifest|spine|itemref|item|meta)(?=[\s>])/g, '<$1o:$2');
  expect(parsePackage(xml).coverPath).toBeNull();
});

test('retains optional Dublin Core fields and empty extension values', () => {
  const xml = opf({
    metadata: `${metadata}<dc:publisher>Publisher</dc:publisher>
    <dc:description>Description</dc:description><dc:date>2026</dc:date><dc:rights>Original</dc:rights>
    <meta id="empty"/><meta property="custom"> value </meta><dc:creator/>`,
  });
  expect(parsePackage(xml).metadata).toMatchObject({
    publisher: 'Publisher',
    description: 'Description',
    date: '2026',
    rights: 'Original',
    creators: ['First author', 'Second author', ''],
  });
  expect(parsePackage(xml).metadata.entries).toContainEqual({
    name: '',
    value: '',
    id: 'empty',
    refines: null,
  });
});

test('records the actual even spine step for canonical publication positions', () => {
  expect(parsePackage(opf()).spineStep).toBe(6);
  expect(parsePackage(opf().replace('<metadata>', '<extension/><metadata>')).spineStep).toBe(8);
});
