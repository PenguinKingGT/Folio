/** Untrusted JSON manifests fail early on invalid identity, resource references, navigation, or bounded input. */
import { expect, test } from 'vitest';
import { parseJsonManifest } from '../../../src/index';
import { jsonManifest } from './fixture';

/** Keep unrelated publication requirements valid while isolating one hostile or invalid field. */
function manifest(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    metadata: { identifier: 'errors', title: 'Original', language: 'en' },
    readingOrder: [{ href: 'a.xhtml' }],
    ...overrides,
  };
}

test('rejects malformed/oversized documents, missing required values, invalid types, and null aliases', () => {
  for (const input of [
    null,
    [],
    3,
    '{broken',
    'x'.repeat(5 * 1024 * 1024 + 1),
    {},
    manifest({ metadata: null }),
    manifest({ metadata: { identifier: 'a', title: '', language: 'en' } }),
    manifest({ metadata: { identifier: 'a', title: 'A', language: [] } }),
    manifest({ metadata: { identifier: 'a', title: 'A', language: [null] } }),
    manifest({ metadata: { identifier: 'a', title: 'A', language: 'en', creator: [null] } }),
    manifest({ metadata: { identifier: 'a', title: 'A', language: 'en', rendition: [] } }),
    manifest({ metadata: { identifier: 'a', title: 'A', language: 'en', direction: 'sideways' } }),
    manifest({ readingOrder: null, spine: [{ href: 'a.xhtml' }] }),
    manifest({ readingOrder: [] }),
    manifest({ readingOrder: Array.from({ length: 10_001 }, () => ({ href: 'a.xhtml' })) }),
  ]) {
    expect(() => parseJsonManifest(input)).toThrow();
  }
});

test('rejects ambiguous resource IDs, missing references, non-XHTML chapters and invalid linear flags', () => {
  for (const input of [
    manifest({
      resources: [
        { id: 'a', href: 'a.png' },
        { id: 'a', href: 'b.png' },
      ],
    }),
    manifest({
      resources: [{ id: 'a', href: 'a.xhtml' }],
      readingOrder: [{ idref: 'a', href: 'b.xhtml' }],
    }),
    manifest({
      resources: [{ id: 'a', href: 'a.xhtml' }],
      readingOrder: [{ idref: 'a', href: 'a.xhtml', type: 'image/png' }],
    }),
    manifest({ readingOrder: [{ idref: 'missing' }] }),
    manifest({ readingOrder: [{ href: 'a.png', type: 'image/png' }] }),
    manifest({ readingOrder: [{ href: 'a.xhtml', linear: 0 }] }),
    manifest({ resources: [{ href: 'a.xhtml', fallback: 'missing' }] }),
    manifest({ resources: [{ href: 'a.xhtml', mediaOverlay: 'missing' }] }),
    manifest({ resources: [{ href: 'a.xhtml', type: null }] }),
    manifest({ resources: [{ href: 'a.xhtml', properties: [null] }] }),
  ]) {
    expect(() => parseJsonManifest(input)).toThrow();
  }
});

test('rejects unsafe/malformed hrefs, empty destinations and excessively large text fields', () => {
  for (const target of [
    '',
    '#only',
    'javascript:alert(1)',
    'vbscript:run',
    'file:///private',
    'a\u0000.xhtml',
    'bad%XX.xhtml',
    'a'.repeat(4097),
    'a'.repeat(16_385),
  ]) {
    expect(() => parseJsonManifest(manifest({ readingOrder: [{ href: target }] }))).toThrow();
  }
  expect(() => parseJsonManifest(manifest({ resources: 'wrong' }))).toThrow('array');
  expect(() => parseJsonManifest(manifest({ toc: [{ title: 'Empty' }] }))).toThrow(
    'href or children',
  );
  expect(() =>
    parseJsonManifest(
      manifest({
        toc: [
          { id: 'dup', title: 'A', href: 'a.xhtml' },
          { id: 'dup', title: 'B', href: 'b.xhtml' },
        ],
      }),
    ),
  ).toThrow('Duplicate');
  expect(() =>
    parseJsonManifest(manifest({ landmarks: [{ title: 'A', href: 'a.xhtml' }] })),
  ).toThrow('semantic');
  expect(() =>
    parseJsonManifest(manifest({ toc: [{ title: 'A', href: 'a.xhtml', children: null }] })),
  ).toThrow('array');
});

test('bounds recursive/cyclic navigation and aggregate entries without mutating input', () => {
  const cyclic: Record<string, unknown> = { title: 'Cycle' };
  cyclic.children = [cyclic];
  expect(() => parseJsonManifest(manifest({ toc: [cyclic] }))).toThrow('depth');
  const leaf = { title: 'Leaf', href: 'a.xhtml' };
  expect(() =>
    parseJsonManifest(
      manifest({
        toc: [
          { title: 'Group', children: Array.from({ length: 10_000 }, () => ({ ...leaf })) },
          leaf,
        ],
      }),
    ),
  ).toThrow('entry count');
  const original = jsonManifest();
  expect(() => parseJsonManifest(original)).not.toThrow();
});

test('idref-only entries cannot override an existing resource with a conflicting or invalid media type', () => {
  for (const type of ['image/png', null]) {
    expect(() =>
      parseJsonManifest(
        manifest({
          resources: [{ id: 'chapter', href: 'a.xhtml', type: 'application/xhtml+xml' }],
          readingOrder: [{ idref: 'chapter', type }],
        }),
      ),
    ).toThrow();
  }
});
