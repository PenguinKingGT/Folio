/** Passive link preparation preserves namespace targets and accessibility metadata without trusting forged markers. */
import { expect, test } from 'vitest';
import { passiveLinks } from '../../../src/content/links';

test('neutralizes native hrefs while preserving authored roles, tab order, and SVG target metadata', () => {
  const document = new DOMParser().parseFromString(
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>
    <a id="note" href="#note-body" role="doc-noteref" tabindex="-1">Note</a>
    <span id="forged" data-folio-href="https://forged.invalid">Text</span>
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a id="svg-link" xlink:href="next.xhtml"><text>Next</text></a></svg>
  </body></html>`,
    'application/xhtml+xml',
  );
  passiveLinks(document);
  const note = document.getElementById('note');
  expect(note?.getAttribute('href')).toBeNull();
  expect(note?.getAttribute('data-folio-href')).toBe('#note-body');
  expect(note?.getAttribute('role')).toBe('doc-noteref');
  expect(note?.getAttribute('tabindex')).toBe('-1');
  expect(document.getElementById('forged')?.hasAttribute('data-folio-href')).toBe(false);
  const svg = document.getElementById('svg-link');
  expect(svg?.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBeNull();
  expect(svg?.getAttribute('data-folio-href')).toBe('next.xhtml');
});
