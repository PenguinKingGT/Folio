/** Preserve optional EPUB 2 NCX print-page labels, destination links, and page categories. */
import type { Element } from '@xmldom/xmldom';
import { children } from '../xml/parse';
import type { PrintPageLink } from './types';
const ncxNamespace = 'http://www.daisy.org/z3986/2005/ncx/';

/** Read pageTarget document order rather than reordering or coercing printed labels. */
export function parseNcxPages(root: Element): readonly PrintPageLink[] {
  const lists = children(root, 'pageList', ncxNamespace);
  if (lists.length > 1) {
    throw new TypeError('NCX requires at most one pageList.');
  }
  const list = lists[0];
  if (list === undefined) {
    return [];
  }
  const targets = children(list, 'pageTarget', ncxNamespace);
  if (targets.length > 10_000) {
    throw new RangeError('Print-page list exceeds the supported limit.');
  }
  return targets.map((target) => {
    const navLabel = children(target, 'navLabel', ncxNamespace)[0];
    const text = navLabel === undefined ? undefined : children(navLabel, 'text', ncxNamespace)[0];
    const label = (text?.textContent || '').trim().replace(/\s+/g, ' ');
    const href = children(target, 'content', ncxNamespace)[0]?.getAttribute('src')?.trim();
    if (label === '' || !href) {
      throw new TypeError('NCX page targets require a label and content src.');
    }
    return { id: target.getAttribute('id'), label, href, type: target.getAttribute('type') };
  });
}
