/** Original EPUB 2/3 integration fixtures, generated under the Folio license. */
import { strToU8, zipSync } from 'fflate';
import { opf } from '../package/fixture';
import { nav, ncx, point } from '../navigation/fixture';

/** Generate all resources of a minimal valid publication without copying upstream material. */
export function bookFiles(edition: '2' | '3' = '3', withNavigation = true): Map<string, string> {
  const navigation =
    edition === '3'
      ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
      : '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>';
  const xml = opf({
    attributes: `version="${edition}.0" unique-identifier="uid"`,
    manifest:
      '<item id="chapter" href="text/chapter%20one.xhtml" media-type="application/xhtml+xml"/><item id="cover" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>' +
      (withNavigation ? navigation : ''),
  });
  return new Map([
    ['mimetype', 'application/epub+zip'],
    [
      'META-INF/container.xml',
      '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ],
    [
      'OPS/package.opf',
      edition === '2' && withNavigation ? xml.replace('<spine ', '<spine toc="ncx" ') : xml,
    ],
    ['OPS/nav.xhtml', nav('<li><a href="text/chapter%20one.xhtml">Original chapter</a></li>')],
    ['OPS/toc.ncx', ncx(point('chapter-nav', 'text/chapter%20one.xhtml'))],
    [
      'OPS/text/chapter one.xhtml',
      '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original chapter text</p></body></html>',
    ],
    ['OPS/images/cover.jpg', 'original cover bytes'],
  ]);
}

/** Store the original publication in ZIP form, with an uncompressed leading mimetype entry. */
export function bookZip(files = bookFiles()): Uint8Array {
  return zipSync(Object.fromEntries([...files].map(([name, text]) => [name, strToU8(text)])), {
    level: 0,
  });
}
