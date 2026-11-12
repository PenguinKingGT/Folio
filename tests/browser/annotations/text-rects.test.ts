/** Selected text geometry excludes blocks, obeys partial endpoints, and bounds adversarial native traversal. */
import { expect, test } from 'vitest';
import { selectedTextRects } from '../../../src/annotations/text-rects';

test('reads only selected text while excluding unrelated sibling nodes and empty element ranges', () => {
  const host = document.createElement('div');
  host.innerHTML = '<b>Before</b><i>Chosen</i><span>After</span>';
  document.body.appendChild(host);
  try {
    const selected = host.querySelector('i');
    if (!selected) {
      throw new Error('Missing authored target.');
    }
    const range = document.createRange();
    range.selectNode(selected);
    const text = document.createRange();
    text.selectNodeContents(selected.firstChild ?? selected);
    expect(
      selectedTextRects(range).map(({ x, y, width, height }) => ({ x, y, width, height })),
    ).toEqual(
      Array.from(text.getClientRects(), ({ x, y, width, height }) => ({ x, y, width, height })),
    );
    range.selectNodeContents(document.createElement('img'));
    expect(selectedTextRects(range)).toEqual([]);
  } finally {
    host.remove();
  }
});

test('rejects document-root ranges before attempting annotation geometry', () => {
  const range = document.createRange();
  range.selectNodeContents(document);
  expect(() => selectedTextRects(range)).toThrow('document-owned');
});

test('bounds selected text nodes even when all content is hidden and produces no rectangles', () => {
  const host = document.createElement('div');
  host.hidden = true;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 20_001; index++) {
    fragment.appendChild(document.createTextNode('x'));
  }
  host.appendChild(fragment);
  document.body.appendChild(host);
  try {
    const range = document.createRange();
    range.selectNodeContents(host);
    expect(() => selectedTextRects(range)).toThrow('text nodes');
  } finally {
    host.remove();
  }
});

test('bounds native fragments from one text node before projecting or painting them', () => {
  const host = document.createElement('pre');
  host.style.cssText = 'font:1px/1px monospace;margin:0';
  host.textContent = 'x\n'.repeat(20_001);
  document.body.appendChild(host);
  try {
    const range = document.createRange();
    range.selectNodeContents(host.firstChild ?? host);
    expect(() => selectedTextRects(range)).toThrow('native annotation fragments');
  } finally {
    host.remove();
  }
});
