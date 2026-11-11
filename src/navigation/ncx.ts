/** Parse EPUB 2 NCX reading navigation, preserving nested navPoint order. */
import type { Element } from '@xmldom/xmldom';
import { children } from '../xml/parse';
import { Navigation } from './navigation';
import type { NavigationItem } from './navigation';

export const ncxNamespace = 'http://www.daisy.org/z3986/2005/ncx/';

/** Parse nested points without trusting playOrder to reorder document structure. */
function parsePoints(parent: Element, depth: number): NavigationItem[] {
  if (depth > 64) {
    throw new RangeError('NCX nesting exceeds the supported limit.');
  }
  return children(parent, 'navPoint', ncxNamespace).map((point) => {
    const labelElement = children(point, 'navLabel', ncxNamespace)[0];
    const text =
      labelElement === undefined ? undefined : children(labelElement, 'text', ncxNamespace)[0];
    const label = (text?.textContent || '').trim().replace(/\s+/g, ' ');
    const href = children(point, 'content', ncxNamespace)[0]?.getAttribute('src');
    if (label === '' || href === undefined || href === null || href.trim() === '') {
      throw new TypeError('NCX points require a label and content src.');
    }
    return { id: point.getAttribute('id'), label, href, children: parsePoints(point, depth + 1) };
  });
}

/** Read the NCX navMap; pageList is handled separately by the print-page feature. */
export function parseNcx(root: Element): Navigation {
  const maps = children(root, 'navMap', ncxNamespace);
  const map = maps[0];
  if (maps.length !== 1 || map === undefined) {
    throw new TypeError('NCX requires exactly one navMap.');
  }
  return new Navigation(parsePoints(map, 0));
}
