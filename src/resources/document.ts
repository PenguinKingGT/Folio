/** Replace XHTML asset references while preserving chapter links for reader navigation. */
import { XMLSerializer } from '@xmldom/xmldom';
import { parseXml } from '../xml/parse';
import { rewriteCss } from './css';

/** Rewrite supported asset attributes, style elements, and inline CSS in XHTML. */
export async function rewriteDocument(
  source: string,
  rewrite: (href: string) => Promise<string>,
): Promise<string> {
  const document = parseXml(source, 'xhtml');
  const elements = Array.from(document.getElementsByTagName('*'));
  for (const element of elements) {
    for (const attribute of ['src', 'poster', 'data']) {
      const value = element.getAttribute(attribute);
      if (value !== null) {
        element.setAttribute(attribute, await rewrite(value));
      }
    }
    if (['link', 'image', 'use'].includes(element.localName ?? '')) {
      for (const attribute of ['href', 'xlink:href']) {
        const value = element.getAttribute(attribute);
        if (value !== null) {
          element.setAttribute(attribute, await rewrite(value));
        }
      }
    }
    const style = element.getAttribute('style');
    if (style !== null) {
      element.setAttribute('style', await rewriteCss(style, rewrite, 'declarationList'));
    }
    if (element.localName === 'style') {
      element.textContent = await rewriteCss(element.textContent || '', rewrite);
    }
  }
  return new XMLSerializer().serializeToString(document);
}
