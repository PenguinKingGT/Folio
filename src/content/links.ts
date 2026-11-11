/** Preserve hyperlink targets as passive data so blocked frame callbacks can never navigate outside reader control. */

/** Native XHTML/SVG hyperlinks share one reader-owned metadata marker. */
export const linkAttribute = 'data-folio-href';
const xlink = 'http://www.w3.org/1999/xlink';

/** Disable browser navigation before assigning srcdoc, retaining the original URI for host activation. */
export function passiveLinks(document: Document): void {
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    if (!['a', 'area'].includes(element.localName.toLowerCase())) {
      element.removeAttribute(linkAttribute);
      continue;
    }
    passiveLink(element);
  }
}

/** Process one link; retain validated srcdoc markers during later native DOM refreshes. */
export function passiveLink(element: Element, preserve = false): void {
  const href = element.getAttribute('href') ?? element.getAttributeNS(xlink, 'href');
  if (href !== null) {
    element.setAttribute(linkAttribute, href);
    element.removeAttribute('href');
    element.removeAttributeNS(xlink, 'href');
    if (!element.hasAttribute('role')) {
      element.setAttribute('role', 'link');
    }
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }
  } else if (!preserve) {
    element.removeAttribute(linkAttribute);
  }
}
