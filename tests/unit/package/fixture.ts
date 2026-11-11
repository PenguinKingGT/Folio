/** Original OPF 2/3 fixtures authored for Folio under the project license. */
export const metadata = `<dc:identifier id="uid">urn:folio:test</dc:identifier>
  <dc:title>Original title</dc:title><dc:language>en</dc:language>
  <dc:creator id="creator">First author</dc:creator><dc:creator>Second author</dc:creator>
  <meta property="rendition:layout">pre-paginated</meta>
  <meta property="role" refines="#creator">aut</meta>`;

export const manifest = `<item id="chapter" href="text/chapter.xhtml" media-type="application/xhtml+xml"/>
  <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  <item id="cover" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`;

/** Generate a complete valid OPF while allowing narrowly targeted invalid sections. */
export function opf(
  options: { metadata?: string; manifest?: string; spine?: string; attributes?: string } = {},
): string {
  return `<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" ${options.attributes ?? 'version="3.0" unique-identifier="uid"'}>
    <metadata>${options.metadata ?? metadata}</metadata>
    <manifest>${options.manifest ?? manifest}</manifest>
    <spine ${options.spine === undefined ? '' : 'page-progression-direction="rtl"'}>${options.spine ?? '<itemref idref="chapter"/>'}</spine>
  </package>`;
}
