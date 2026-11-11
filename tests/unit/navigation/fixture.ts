/** Original navigation fixture builders under the project license. */
/** Wrap original toc markup in a complete XHTML navigation document. */
export function nav(toc: string, extra = ''): string {
  return `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head/><body>
    <nav epub:type="toc"><ol>${toc}</ol></nav>${extra}</body></html>`;
}

/** Wrap points in the NCX namespace with a standard external doctype. */
export function ncx(points: string): string {
  return `<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "https://example.invalid/ncx.dtd"><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>${points}</navMap></ncx>`;
}

/** Build one labeled NCX point, optionally containing nested points. */
export function point(id: string, href: string, nested = ''): string {
  return `<navPoint id="${id}"><navLabel><text>${id}</text></navLabel><content src="${href}"/>${nested}</navPoint>`;
}
