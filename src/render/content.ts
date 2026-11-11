/** Prepare passive chapter content with a reader-owned CSP before assigning iframe srcdoc. */
const xhtml = 'http://www.w3.org/1999/xhtml';
const blocked = new Set(['script', 'iframe', 'object', 'embed', 'form', 'base']);
const policy =
  "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' blob:; img-src blob: data:; font-src blob: data:; media-src blob: data:; frame-src 'none'; object-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";

/** HTML srcdoc parsing does not recognize XML namespace prefixes on HTML/SVG/MathML tags. */
function normalizePrefixes(document: Document): void {
  const supported = new Set([
    xhtml,
    'http://www.w3.org/2000/svg',
    'http://www.w3.org/1998/Math/MathML',
  ]);
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.prefix === 'xmlns' && supported.has(attribute.value)) {
        element.removeAttributeNode(attribute);
      }
    }
    if (
      element.prefix !== null &&
      element.namespaceURI !== null &&
      supported.has(element.namespaceURI)
    ) {
      const replacement = document.createElementNS(element.namespaceURI, element.localName);
      for (const attribute of Array.from(element.attributes)) {
        replacement.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
      }
      while (element.firstChild !== null) {
        replacement.appendChild(element.firstChild);
      }
      element.parentNode?.replaceChild(replacement, element);
    }
  }
}

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
    const refresh =
      name === 'meta' &&
      (element.getAttribute('http-equiv') || '').trim().toLowerCase() === 'refresh';
    if (blocked.has(name) || refresh) {
      element.remove();
      continue;
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
  const document = new DOMParser().parseFromString(source, 'application/xhtml+xml');
  normalizePrefixes(document);
  const root = document.documentElement;
  if (
    root.localName !== 'html' ||
    root.namespaceURI !== xhtml ||
    document.getElementsByTagName('parsererror').length > 0
  ) {
    throw new TypeError('Expected a valid XHTML chapter.');
  }
  makePassive(document);
  if (document.getElementsByTagNameNS(xhtml, 'body').length !== 1) {
    throw new TypeError('A chapter requires exactly one body.');
  }
  let head = document.getElementsByTagNameNS(xhtml, 'head').item(0);
  if (head === null) {
    head = document.createElementNS(xhtml, 'head');
    root.insertBefore(head, root.firstChild);
  }
  const csp = document.createElementNS(xhtml, 'meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', policy);
  head.insertBefore(csp, head.firstChild);
  root.setAttribute('data-folio-document', token);
  // Standards mode keeps CSS columns and the browser scrolling root consistent across engines.
  return '<!DOCTYPE html>' + new XMLSerializer().serializeToString(root);
}
