/** Parse optional EPUB 3 and NCX print-page navigation without losing labels or namespace identity. */
import { expect, test } from 'vitest';
import { parseNavigation } from '../../../src/index';
import { nav, ncx } from '../navigation/fixture';

/** Wrap original page-list markup while retaining a valid independent TOC. */
function pageNav(list: string): string {
  return nav('', `<nav epub:type="page-list"><ol>${list}</ol></nav>`);
}

test('preserves grouped, Roman, sparse, repeated, and alternate-title labels', () => {
  const source = pageNav(
    '<li><span>Front matter</span><ol><li id="front"><a href="chapter.xhtml#iv">iv</a></li></ol></li><li><a id="one" href="chapter.xhtml#one">1</a></li><li><a href="chapter.xhtml#three" title=" Page  3 "> </a></li><li><a href="chapter.xhtml#again">1</a></li>',
  );
  const pages = parseNavigation(
    source.replace('xmlns:epub=', 'xmlns:publication=').replaceAll('epub:type', 'publication:type'),
  ).pages;
  expect(pages.map((page) => page.label)).toEqual(['iv', '1', 'Page 3', '1']);
  expect(pages[0]).toEqual({ id: 'front', label: 'iv', href: 'chapter.xhtml#iv', type: null });
  expect(pages[1]?.id).toBe('one');
  expect(parseNavigation(nav('')).pages).toEqual([]);
  expect(parseNavigation(pageNav('')).pages).toEqual([]);
});

test('rejects duplicate lists, missing destinations, unlabeled entries and ambiguous anchors', () => {
  const invalid = [
    '<li><a href="x"/></li>',
    '<li><a>1</a></li>',
    '<li><a href=" ">1</a></li>',
    '<li><span>1</span></li>',
    '<li><a href="x">1</a><a href="y">2</a></li>',
  ];
  for (const body of invalid) {
    expect(() => parseNavigation(pageNav(body))).toThrow('Print-page');
  }
  const duplicate = nav(
    '',
    '<nav epub:type="page-list"><ol/></nav><nav epub:type="page-list"><ol/></nav>',
  );
  expect(() => parseNavigation(duplicate)).toThrow('page-list');
  expect(() => parseNavigation(nav('', '<nav epub:type="page-list"/>'))).toThrow('page-list');
  expect(() => parseNavigation(nav('', '<nav epub:type="page-list"><ol/><ol/></nav>'))).toThrow(
    'page-list',
  );
});

test('bounds nested and oversized page lists before allocating an index', () => {
  const deep =
    '<li><span>Group</span><ol>'.repeat(66) +
    '<li><a href="x">1</a></li>' +
    '</ol></li>'.repeat(66);
  expect(() => parseNavigation(pageNav(deep))).toThrow('nesting');
  expect(() => parseNavigation(pageNav('<li><a href="x">1</a></li>'.repeat(10_001)))).toThrow(
    'limit',
  );
});

/** Add a pageList beside an otherwise valid NCX navMap. */
function pageNcx(items: string): string {
  return ncx('').replace('</ncx>', `<pageList>${items}</pageList></ncx>`);
}

test('preserves NCX front/normal/special types and document order independently of playOrder', () => {
  const source = pageNcx(
    '<pageTarget id="front" type="front" playOrder="9"><navLabel><text> iv </text></navLabel><content src="chapter.xhtml#iv"/></pageTarget><pageTarget type="special"><navLabel><text> A-1 </text></navLabel><content src="chapter.xhtml#one"/></pageTarget>',
  );
  const pages = parseNavigation(source).pages;
  expect(pages).toEqual([
    { id: 'front', type: 'front', label: 'iv', href: 'chapter.xhtml#iv' },
    { id: null, type: 'special', label: 'A-1', href: 'chapter.xhtml#one' },
  ]);
  expect(parseNavigation(ncx('')).pages).toEqual([]);
  expect(parseNavigation(pageNcx('')).pages).toEqual([]);
});

test('rejects NCX duplicates, malformed page targets, and excessive entry counts', () => {
  const valid =
    '<pageTarget><navLabel><text>1</text></navLabel><content src="chapter.xhtml"/></pageTarget>';
  expect(() => parseNavigation(pageNcx(valid).replace('</ncx>', '<pageList/></ncx>'))).toThrow(
    'at most one',
  );
  for (const item of [
    '<pageTarget/>',
    '<pageTarget><navLabel/><content src="x"/></pageTarget>',
    '<pageTarget><navLabel><text>1</text></navLabel></pageTarget>',
    valid.replace('src="chapter.xhtml"', 'src=" "'),
  ]) {
    expect(() => parseNavigation(pageNcx(item))).toThrow('page targets');
  }
  expect(() => parseNavigation(pageNcx(valid.repeat(10_001)))).toThrow('limit');
});
