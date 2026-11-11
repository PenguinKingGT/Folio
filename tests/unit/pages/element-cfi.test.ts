/** Headless element CFIs must reject non-body targets and match the passive rendering tree. */
import { expect, test } from 'vitest';
import { parseXml } from '../../../src/xml/parse';
import { elementCfi } from '../../../src/pages/element-cfi';

const base = '/6/2[chapter]';

test('encodes body and descendant IDs while skipping removed script and refresh elements', () => {
  const document = parseXml(
    '<html xmlns="http://www.w3.org/1999/xhtml"><body><script/><meta http-equiv=" ReFresh "/><style>p{color:black}</style><section id="outer"><span id="page"/></section></body></html>',
  );
  expect(elementCfi(document, '', base)).toBe('epubcfi(/6/2[chapter]!/4)');
  expect(elementCfi(document, 'page', base)).toBe('epubcfi(/6/2[chapter]!/4/4[outer]/2[page])');
  expect(() => elementCfi(document, 'missing', base)).toThrow('anchor not found');
});

test('rejects absent bodies, head anchors, and elements removed with an active ancestor', () => {
  expect(() =>
    elementCfi(parseXml('<html xmlns="http://www.w3.org/1999/xhtml"><head/></html>'), '', base),
  ).toThrow('body');
  const head = parseXml(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><meta id="head"/></head><body/></html>',
  );
  expect(() => elementCfi(head, 'head', base)).toThrow('inside the XHTML body');
  const active = parseXml(
    '<html xmlns="http://www.w3.org/1999/xhtml"><body><form><span id="removed"/></form></body></html>',
  );
  expect(() => elementCfi(active, 'removed', base)).toThrow('removed passive');
});

test('bounds deeply nested page-break paths', () => {
  const document = parseXml(
    `<html xmlns="http://www.w3.org/1999/xhtml"><body>${'<div>'.repeat(130)}<span id="page"/>${'</div>'.repeat(130)}</body></html>`,
  );
  expect(() => elementCfi(document, 'page', base)).toThrow('nesting');
});
