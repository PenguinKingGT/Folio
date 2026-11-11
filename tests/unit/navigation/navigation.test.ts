/** Original EPUB 2/3 navigation fixtures with grouped and nested entries. */
import { expect, test } from 'vitest';
import { Navigation, parseNavigation } from '../../../src/index';

import { nav, ncx, point } from './fixture';

test('preserves grouped TOC entries, Unicode hrefs and semantic landmarks', () => {
  const directory = parseNavigation(
    nav(
      '<li id="part"><span> Part  one </span><ol><li><a id="chapter" href="text/%E4%B9%A6.xhtml#start">Book</a></li></ol></li>',
      '<nav epub:type="landmarks"><ol><li><a epub:type="bodymatter chapter" href="text/book.xhtml">Start</a></li></ol></nav>',
    ),
  );
  expect(directory.toc[0]).toMatchObject({ id: 'part', label: 'Part one', href: null });
  expect(directory.get('#chapter')?.label).toBe('Book');
  expect(directory.get('text/书.xhtml#start')?.id).toBe('chapter');
  expect(directory.get('#missing')).toBeNull();
  expect(directory.get('unknown')).toBeNull();
  expect(directory.landmark('bodymatter')?.href).toBe('text/book.xhtml');
  expect(directory.landmark('chapter')?.label).toBe('Start');
  expect(directory.landmark('missing')).toBeNull();
});

test('parses nested NCX points and prefixed namespaces', () => {
  const directory = parseNavigation(ncx(point('one', 'one.xhtml', point('two', 'two.xhtml'))));
  expect(directory.toc[0]?.children[0]?.label).toBe('two');
  expect(directory.get('#one')?.href).toBe('one.xhtml');
  expect(directory.landmarks).toEqual([]);
  const prefixed = ncx(point('one', 'one.xhtml'))
    .replace('xmlns=', 'xmlns:n=')
    .replace(/<(\/?)(ncx|navMap|navPoint|navLabel|text|content)(?=[\s>])/g, '<$1n:$2');
  expect(parseNavigation(prefixed).get('one.xhtml')?.label).toBe('one');
});

test('retains the first repeated href and accepts an empty toc', () => {
  const directory = parseNavigation(
    nav('<li><a href="same.xhtml">First</a></li><li><a href="same.xhtml">Second</a></li>'),
  );
  expect(directory.get('same.xhtml')?.label).toBe('First');
  expect(parseNavigation(nav('')).toc).toEqual([]);
  expect(new Navigation([]).landmarks).toEqual([]);
});
