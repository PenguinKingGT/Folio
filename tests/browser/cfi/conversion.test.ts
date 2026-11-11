/** Verify real-browser Node and Range conversion, including UTF-16 and transparent annotations. */
import { expect, test } from 'vitest';
import { cfiFromNode, cfiFromRange, nodeFromCfi, rangeFromCfi } from '../../../src/index';
import { child, element, fixture, options, range } from './fixture';

test('round trips UTF-16 offsets including surrogate pairs', () => {
  const document = fixture();
  const text = child(element(document, '#para'));
  const original = range(document, text, 1, text, 4);
  const cfi = cfiFromRange(original, options);
  expect(cfi.spineIndex).toBe(0);
  const restored = rangeFromCfi(document, cfi.toString());
  expect(restored.toString()).toBe('😀B');
  expect(restored.startContainer).toBe(text);
  expect(restored.startOffset).toBe(1);
  expect(restored.endOffset).toBe(4);
  expect(nodeFromCfi(document, cfi)).toBe(text);
});

test('round trips ranges across paragraphs and meaningful inline elements', () => {
  const document = fixture('<p id="a">Hello <em id="em">wide</em> world</p><p id="b">Second</p>');
  const first = child(element(document, '#a'));
  const last = child(element(document, '#b'));
  const original = range(document, first, 2, last, 4);
  expect(rangeFromCfi(document, cfiFromRange(original, options)).toString()).toBe(
    original.toString(),
  );
  const em = element(document, '#em');
  expect(nodeFromCfi(document, cfiFromNode(em, options))).toBe(em);
});

test('keeps logical text positions stable across annotation wrappers and comments', () => {
  const document = fixture('<p id="para">abc<!-- ignored --><span class="mark">de</span>fg</p>');
  const p = element(document, '#para');
  const wrapper = element(document, '.mark');
  const original = range(document, child(wrapper), 0, child(p, 3), 1);
  const settings = { ...options, ignoreClass: 'mark' };
  const cfi = cfiFromRange(original, settings);
  expect(rangeFromCfi(document, cfi, 'mark').toString()).toBe('def');
  p.textContent = 'abcdefg';
  expect(rangeFromCfi(document, cfi, 'mark').toString()).toBe('def');
});

test('merges adjacent text nodes and respects explicit side bias', () => {
  const document = fixture('<p id="para">ab</p>');
  const p = element(document, '#para');
  p.appendChild(document.createTextNode('cd'));
  const second = child(p, 1);
  const cfi = cfiFromNode(second, options);
  expect(rangeFromCfi(document, cfi).startContainer).toBe(child(p));
  const after = cfi.toString().replace(':2)', ':2[;s=a])');
  expect(rangeFromCfi(document, after).startContainer).toBe(second);
  expect(rangeFromCfi(document, after).startOffset).toBe(0);
  expect(rangeFromCfi(document, cfi.toString().replace(':2)', ':4[;s=a])')).startOffset).toBe(2);
});

test('normalizes element boundaries to equivalent text selections', () => {
  const document = fixture('<p id="para"><em>first</em> last</p><span id="empty"/>');
  const p = element(document, '#para');
  const original = document.createRange();
  original.selectNodeContents(p);
  expect(rangeFromCfi(document, cfiFromRange(original, options)).toString()).toBe('first last');
  for (const offset of [0, p.childNodes.length]) {
    const collapsed = range(document, p, offset);
    expect(rangeFromCfi(document, cfiFromRange(collapsed, options)).collapsed).toBe(true);
  }
  const empty = element(document, '#empty');
  expect(nodeFromCfi(document, cfiFromRange(range(document, empty, 0), options))).toBe(empty);
});

test('repairs moved element indexes using ID assertions', () => {
  const document = fixture();
  const text = child(element(document, '#para'));
  const cfi = cfiFromRange(range(document, text, 1, text, 4), options);
  document.body.insertBefore(document.createElement('p'), document.body.firstChild);
  expect(rangeFromCfi(document, cfi).toString()).toBe('😀B');
});

test('supports CDATA in XML documents without changing UTF-16 indexing', () => {
  const document = new DOMParser().parseFromString(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>A<![CDATA[BC]]>D</p></body></html>',
    'application/xhtml+xml',
  );
  const cdata = child(element(document, 'p'), 1);
  const cfi = cfiFromRange(range(document, cdata, 1), options);
  expect(rangeFromCfi(document, cfi).startContainer).toBe(cdata);
  expect(rangeFromCfi(document, cfi).startOffset).toBe(1);
});

test('normalizes nested end boundaries and empty-element starts before selected text', () => {
  const document = fixture('<p id="para"><em>first<span> last</span></em></p>');
  const p = element(document, '#para');
  const selected = document.createRange();
  selected.selectNodeContents(p);
  expect(rangeFromCfi(document, cfiFromRange(selected, options)).toString()).toBe('first last');
  const empty = document.createElement('span');
  p.insertBefore(empty, p.firstChild);
  const end = child(element(document, 'em span'));
  const started = range(document, empty, 0, end, 5);
  expect(rangeFromCfi(document, cfiFromRange(started, options)).toString()).toBe(
    started.toString(),
  );
});
