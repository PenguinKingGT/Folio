/** Parse a structurally valid native XHTML document and normalize XML prefixes before HTML srcdoc serialization. */
import { validateXmlSource } from '../xml/constraints';

const xhtml = 'http://www.w3.org/1999/xhtml';

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

/** Ensure canonical head/body ownership for native layout, CFI paths, and an early policy insertion point. */
export function nativeContent(source: string): {
  document: Document;
  root: Element;
  head: Element;
} {
  const input = validateXmlSource(source, 'xhtml');
  const document = new DOMParser().parseFromString(input, 'application/xhtml+xml');
  normalizePrefixes(document);
  const root = document.documentElement;
  if (
    root.localName !== 'html' ||
    root.namespaceURI !== xhtml ||
    document.getElementsByTagName('parsererror').length > 0
  ) {
    throw new TypeError('Expected a valid XHTML chapter.');
  }
  const bodies = document.getElementsByTagNameNS(xhtml, 'body');
  if (bodies.length !== 1 || bodies.item(0)?.parentNode !== root) {
    throw new TypeError('A chapter requires exactly one direct body.');
  }
  const heads = document.getElementsByTagNameNS(xhtml, 'head');
  let head = heads.item(0);
  if (heads.length > 1 || (head !== null && head.parentNode !== root)) {
    throw new TypeError('A chapter permits at most one direct head.');
  }
  if (head === null) {
    head = document.createElementNS(xhtml, 'head');
    root.insertBefore(head, root.firstChild);
  }
  return { document, root, head };
}
