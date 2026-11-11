/** Select the EPUB navigation format by expanded document-root name. */
import { parseXml } from '../xml/parse';
import { parseNav } from './nav';
import { ncxNamespace, parseNcx } from './ncx';
import type { Navigation } from './navigation';

/** Parse an EPUB 3 nav or EPUB 2 NCX document, including prefixed namespaces. */
export function parseNavigation(source: string): Navigation {
  const root = parseXml(source, 'xhtml').documentElement;
  if (root?.localName === 'html' && root.namespaceURI === 'http://www.w3.org/1999/xhtml') {
    return parseNav(root);
  }
  if (root?.localName === 'ncx' && root.namespaceURI === ncxNamespace) {
    return parseNcx(root);
  }
  throw new TypeError('Expected an XHTML navigation or NCX document.');
}
