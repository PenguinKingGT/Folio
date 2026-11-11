/** Read optional EPUB 3 print-page navigation, flattening bounded grouping lists in document order. */
import type { Element } from '@xmldom/xmldom';
import { children } from '../xml/parse';
import type { PrintPageLink } from './types';

const xhtml = 'http://www.w3.org/1999/xhtml';
const ops = 'http://www.idpf.org/2007/ops';

/** Require an end-user label and an actual destination for each page break. */
function page(anchor: Element, item: Element): PrintPageLink {
  const label = ((anchor.textContent || '').trim() || anchor.getAttribute('title') || '')
    .trim()
    .replace(/\s+/g, ' ');
  const href = anchor.getAttribute('href')?.trim();
  if (label === '' || !href) {
    throw new TypeError('Print-page entries require a label and href.');
  }
  return { id: item.getAttribute('id') ?? anchor.getAttribute('id'), label, href, type: null };
}

/** Preserve links in reading order while allowing optional group labels. */
function visit(list: Element, result: PrintPageLink[], depth: number): void {
  if (depth > 64) {
    throw new RangeError('Print-page list nesting exceeds the supported limit.');
  }
  for (const item of children(list, 'li', xhtml)) {
    const anchors = children(item, 'a', xhtml);
    const nested = children(item, 'ol', xhtml);
    if (anchors.length > 1 || (anchors.length === 0 && nested.length === 0)) {
      throw new TypeError('Print-page entries require one anchor or a nested group.');
    }
    const anchor = anchors[0];
    if (anchor !== undefined) {
      result.push(page(anchor, item));
    }
    if (result.length > 10_000) {
      throw new RangeError('Print-page list exceeds the supported limit.');
    }
    for (const child of nested) {
      visit(child, result, depth + 1);
    }
  }
}

/** Absent page-list navigation is valid; duplicate declarations reject. */
export function parseNavPages(root: Element): readonly PrintPageLink[] {
  const navs = Array.from(root.getElementsByTagNameNS(xhtml, 'nav')).filter((element) =>
    (element.getAttributeNS(ops, 'type') ?? '').split(/\s+/).includes('page-list'),
  );
  if (navs.length === 0) {
    return [];
  }
  const nav = navs[0];
  const lists = nav === undefined ? [] : children(nav, 'ol', xhtml);
  const list = lists[0];
  if (navs.length !== 1 || lists.length !== 1 || list === undefined) {
    throw new TypeError('Navigation requires at most one page-list with one ordered list.');
  }
  const result: PrintPageLink[] = [];
  visit(list, result, 0);
  return result;
}
