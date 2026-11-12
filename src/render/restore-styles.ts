/** Restore XML-escaped CSS text after HTML raw-text parsing without reparsing publisher strings as markup. */

/** Decode one serializer layer; ampersands come last so literal entity spellings cannot be decoded twice. */
export function restoreStyles(document: Document): void {
  for (const style of Array.from(
    document.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'style'),
  )) {
    style.textContent = style.textContent
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&');
  }
}
