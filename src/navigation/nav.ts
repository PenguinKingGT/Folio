/** Parse EPUB 3 XHTML navigation using expanded names rather than CSS selectors. */
import type { Element } from '@xmldom/xmldom';
import { children } from '../xml/parse';
import { Navigation } from './navigation';
import type { Landmark, NavigationItem } from './navigation';

const xhtml = 'http://www.w3.org/1999/xhtml';
const ops = 'http://www.idpf.org/2007/ops';

/** Read EPUB semantic tokens independent of the chosen namespace prefix. */
function types(element: Element): string[] {
  return (element.getAttributeNS(ops, 'type') ?? '').split(/\s+/).filter(Boolean);
}

/** Parse a nested ol; nesting is bounded before recursive descent. */
function parseList(list: Element, depth: number): NavigationItem[] {
  if (depth > 64) {
    throw new RangeError('Navigation nesting exceeds the supported limit.');
  }
  return children(list, 'li', xhtml).map((item) => {
    const anchor = children(item, 'a', xhtml)[0];
    const label = anchor ?? children(item, 'span', xhtml)[0];
    if (label === undefined || (label.textContent || '').trim() === '') {
      throw new TypeError('Navigation entries require an anchor or grouping label.');
    }
    const href = anchor?.getAttribute('href') ?? null;
    if (anchor !== undefined && (href === null || href.trim() === '')) {
      throw new TypeError('Navigation anchors require href.');
    }
    const nested = children(item, 'ol', xhtml)[0];
    return {
      id: item.getAttribute('id') ?? label.getAttribute('id'),
      label: (label.textContent || '').trim().replace(/\s+/g, ' '),
      href,
      children: nested === undefined ? [] : parseList(nested, depth + 1),
    };
  });
}

/** Parse TOC and optional semantic landmarks from an XHTML navigation document. */
export function parseNav(root: Element): Navigation {
  const navs = Array.from(root.getElementsByTagNameNS(xhtml, 'nav'));
  const toc = navs.filter((nav) => types(nav).includes('toc'));
  const list = toc[0] === undefined ? undefined : children(toc[0], 'ol', xhtml)[0];
  if (toc.length !== 1 || list === undefined) {
    throw new TypeError('Navigation requires exactly one toc with an ordered list.');
  }
  const landmarks: Landmark[] = [];
  for (const nav of navs.filter((element) => types(element).includes('landmarks'))) {
    for (const anchor of Array.from(nav.getElementsByTagNameNS(xhtml, 'a'))) {
      const href = anchor.getAttribute('href');
      if (href === null || href.trim() === '') {
        throw new TypeError('Landmarks require href.');
      }
      landmarks.push({ types: types(anchor), href, label: (anchor.textContent || '').trim() });
    }
  }
  return new Navigation(parseList(list, 0), landmarks);
}
