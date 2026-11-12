/** JSON normalization preserves metadata, resource identities, reading order, inline navigation, and lazy headless loading. */
import { expect, test } from 'vitest';
import { Book, parseJsonManifest } from '../../../src/index';
import { jsonManifest, jsonFiles, jsonTransport } from './fixture';

test('normalizes a publication without mutating its caller-owned metadata or reading order', () => {
  const input = jsonManifest();
  const before = JSON.stringify(input);
  const { publication, navigation } = parseJsonManifest(input);
  expect(JSON.stringify(input)).toBe(before);
  expect(publication.metadata).toMatchObject({
    identifier: 'original-json',
    title: 'Original JSON',
    language: 'en',
    creators: ['Original Author'],
    description: '',
  });
  expect(publication.spine.map((item) => item.linear)).toEqual([true, false, true]);
  expect(publication.spineStep).toBe(6);
  expect(publication.manifest.get('chapter')?.mediaType).toBe('application/xhtml+xml');
  expect(publication.coverPath).toBe('images/cover.jpg');
  expect(navigation?.get('#entry')?.href).toBe('text/chapter%20one.xhtml#start');
  expect(navigation?.get('text/chapter one.xhtml#start')?.label).toBe('Original chapter');
  expect(navigation?.landmark('bodymatter')?.href).toBe('text/chapter%20one.xhtml');
  expect(navigation?.pages[0]?.label).toBe('1');
});

test('legacy spine/idref, creator, mediaType and subitems aliases retain resource properties and false flags', () => {
  const { publication, navigation } = parseJsonManifest({
    metadata: {
      identifier: 'legacy',
      title: 'Legacy',
      language: 'en',
      creator: 'Original',
      direction: 'rtl',
      layout: 'fixed',
      rendition: { spread: 'both' },
    },
    resources: [
      { id: 'a', href: 'a.xhtml', mediaType: 'application/xhtml+xml', properties: 'scripted' },
    ],
    spine: [
      { idref: 'a', href: 'a.xhtml', properties: 'rendition:page-spread-left', linear: 'no' },
    ],
    toc: [{ label: 'Part', subitems: [{ label: 'Chapter', href: 'a.xhtml' }] }],
  });
  expect(publication.direction).toBe('rtl');
  expect(publication.rendition).toEqual({ layout: 'pre-paginated', spread: 'both' });
  expect(publication.metadata.creators).toEqual(['Original']);
  expect(publication.spine[0]).toMatchObject({
    idref: 'a',
    linear: false,
    properties: ['rendition:page-spread-left'],
  });
  expect(publication.manifest.get('a')?.properties).toEqual(['scripted']);
  expect(navigation?.toc[0]?.children[0]?.label).toBe('Chapter');
});

test('opens a JSON URL without XML container/OPF or browser views and reads chapters only on demand', async () => {
  const transport = jsonTransport();
  const book = await Book.open('https://original.invalid/OPS/manifest.json', {
    fetch: transport.fetch,
  });
  try {
    expect(transport.calls).toEqual(['OPS/manifest.json']);
    expect(book.packagePath).toBe('OPS/manifest.json');
    expect(book.publication.metadata.title).toBe('Original JSON');
    expect(await book.section()?.search('Original JSON')).toHaveLength(1);
    expect(transport.calls).toEqual(['OPS/manifest.json', 'OPS/text/chapter one.xhtml']);
    await book.locations.generate({ breakSize: 3 });
    expect(book.locations.length).toBeGreaterThan(1);
    expect(transport.calls).not.toContain('OPS/notes.xhtml');
    await book.pageList.generate();
    expect(book.pageList.entries[0]?.cfi).toContain('epubcfi(/6/2[chapter]!');
    expect(new TextDecoder().decode(await book.bytes('images/cover.jpg'))).toBe(
      'original cover bytes',
    );
  } finally {
    book.destroy();
  }
});

test('uses declared external nav when inline navigation is absent', async () => {
  const files = jsonFiles();
  files.set(
    'OPS/manifest.json',
    JSON.stringify({
      metadata: { identifier: 'nav-json', title: 'Navigation', language: 'en' },
      readingOrder: [{ href: 'text/chapter%20one.xhtml' }],
      resources: [{ href: 'nav.xhtml', type: 'application/xhtml+xml', rel: 'contents' }],
    }),
  );
  const transport = jsonTransport(files);
  const book = await Book.open('https://original.invalid/OPS/manifest.json', {
    fetch: transport.fetch,
  });
  try {
    expect(book.navigation.toc[0]?.label).toBe('Original chapter');
    expect(transport.calls).toEqual(['OPS/manifest.json', 'OPS/nav.xhtml']);
  } finally {
    book.destroy();
  }
});
