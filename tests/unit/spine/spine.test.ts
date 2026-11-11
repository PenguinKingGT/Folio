/** Reading-order tests use original OPF data and an in-memory chapter loader. */
import { expect, test } from 'vitest';
import { parsePackage, Spine } from '../../../src/index';
import { opf } from '../package/fixture';

/** Build three chapters, with a non-linear middle item and encoded Unicode href. */
function fixture(): ReturnType<typeof parsePackage> {
  return parsePackage(
    opf({
      manifest:
        '<item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="c" href="%E4%B9%A6.xhtml" media-type="application/xhtml+xml"/>',
      spine: '<itemref idref="a"/><itemref idref="b" linear="no"/><itemref idref="c"/>',
    }),
  );
}

test('looks up chapters by index, ID and equivalent encoded hrefs', () => {
  const spine = new Spine(fixture(), () => Promise.resolve('unused'));
  expect(spine.get()?.idref).toBe('a');
  expect(spine.get(1)?.linear).toBe(false);
  expect(spine.get('#b')?.index).toBe(1);
  expect(spine.get('a.xhtml#anchor')?.idref).toBe('a');
  expect(spine.get('书.xhtml')?.idref).toBe('c');
  for (const missing of [-1, 99, 1.5, '#missing', 'unknown.xhtml']) {
    expect(spine.get(missing)).toBeNull();
  }
  expect(spine.adjacent(0, 'next')?.idref).toBe('c');
  expect(spine.adjacent(2, 'previous')?.idref).toBe('a');
  expect(spine.adjacent(0, 'previous')).toBeNull();
  expect(spine.adjacent(2, 'next')).toBeNull();
  expect(spine.adjacent(-1, 'next')).toBeNull();
  const copy = spine.all();
  expect(copy).toHaveLength(3);
  spine.destroy();
  spine.destroy();
  expect(copy).toHaveLength(3);
  expect(() => spine.get()).toThrow('destroyed');
});

test('handles an entirely non-linear spine and rejects invalid constructor models', () => {
  const publication = fixture();
  const spine = new Spine(
    { ...publication, spine: publication.spine.map((item) => ({ ...item, linear: false })) },
    () => Promise.resolve('unused'),
  );
  expect(spine.get()).toBeNull();
  expect(spine.adjacent(0, 'next')).toBeNull();
  expect(
    () => new Spine({ ...publication, manifest: new Map() }, () => Promise.resolve('unused')),
  ).toThrow('missing resource');
});
