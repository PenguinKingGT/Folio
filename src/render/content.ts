/** Prepare passive chapter content with a reader-owned CSP before assigning iframe srcdoc. */
const xhtml = 'http://www.w3.org/1999/xhtml';
import { nativeContent } from '../content/document';
import { passiveElementRemoved } from '../content/policy';
import { passiveLinks } from '../content/links';
const policy =
  "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' blob:; img-src blob: data:; font-src blob: data:; media-src blob: data:; frame-src 'none'; object-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";

/** Recognize active URL schemes even when ASCII whitespace is embedded in their spelling. */
function activeUrl(value: string): boolean {
  const compact = Array.from(value)
    .filter((character) => character.charCodeAt(0) > 32)
    .join('');
  return /^(javascript|vbscript):/i.test(compact);
}

/** Remove active elements, refresh navigation, handlers, and executable URL attributes. */
function makePassive(document: Document): void {
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    const name = element.localName.toLowerCase();
    if (passiveElementRemoved(name, element.getAttribute('http-equiv'))) {
      element.remove();
      continue;
    }
    // HTML srcdoc treats XHTML CDATA as comments outside foreign content; preserve its text explicitly.
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 4) {
        element.replaceChild(document.createTextNode(child.nodeValue || ''), child);
      }
    }
    for (const attribute of Array.from(element.attributes)) {
      const key = attribute.localName.toLowerCase();
      if (
        key.startsWith('on') ||
        (['href', 'src', 'action'].includes(key) && activeUrl(attribute.value))
      ) {
        element.removeAttributeNode(attribute);
      }
    }
  }
}

/**
 * Create passive XHTML with a load identity and restrictive policy placed before author content.
 * Scripted publications are intentionally handled by the separate F34 compatibility feature.
 */
export function prepareContent(source: string, token: string): string {
  const { document, root, head } = nativeContent(source);
  makePassive(document);
  passiveLinks(document);
  const csp = document.createElementNS(xhtml, 'meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', policy);
  head.insertBefore(csp, head.firstChild);
  root.setAttribute('data-folio-document', token);
  // Standards mode keeps CSS columns and the browser scrolling root consistent across engines.
  return '<!DOCTYPE html>' + new XMLSerializer().serializeToString(root);
}
