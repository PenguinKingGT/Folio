/** Upstream #1200 supplies reversed/invalid CFIs; native DOM ordering verifies that path depth is not a reason to reorder them. */
import { expect, test } from 'vitest';
import { Cfi, cfiFromRange, rangeFromCfi } from '../../../src/index';

const later = 'epubcfi(/6/2[id0]!/4/8,/1:273,/1:326)';
const earlier = 'epubcfi(/6/2[id0]!/4/8,/2/1:4,/1:21)';

test('rejects the report range whose structural end precedes its start', () => {
  expect(() => new Cfi(earlier)).toThrow('document order');
  expect(() => new Cfi(later).compare(earlier)).toThrow('document order');
});

test('the reported later CFI selects a nonexistent text slot when the paragraph begins with a bold element', () => {
  const document = window.document.implementation.createHTMLDocument();
  document.body.innerHTML = `<p></p><p></p><p></p><p><b>Opening</b>${'Original following text. '.repeat(30)}</p>`;
  expect(() => rangeFromCfi(document, later)).toThrow('outside the document');
});

test('valid generated ranges preserve native DOM order across inline element and text boundaries', () => {
  const document = window.document.implementation.createHTMLDocument();
  document.body.innerHTML = `<p><b>Opening</b>${'Original following text. '.repeat(30)}</p>`;
  const bold = document.querySelector('b')?.firstChild;
  const following = document.querySelector('p')?.lastChild;
  if (!bold || !following) {
    throw new Error('Expected authored inline/text fixture.');
  }
  const first = document.createRange();
  first.setStart(bold, 4);
  first.setEnd(following, 21);
  const second = document.createRange();
  second.setStart(following, 273);
  second.setEnd(following, 326);
  const a = cfiFromRange(first, { base: '/6/2[id0]' });
  const b = cfiFromRange(second, { base: '/6/2[id0]' });
  expect(first.compareBoundaryPoints(0, second)).toBe(-1);
  expect(a.compare(b)).toBe(-1);
  expect(b.compare(a)).toBe(1);
  expect(rangeFromCfi(document, a).toString()).toBe(first.toString());
  expect(rangeFromCfi(document, b).toString()).toBe(second.toString());
});
