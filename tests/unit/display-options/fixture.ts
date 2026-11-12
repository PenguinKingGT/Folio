/** Original EPUB 2 fixed-layout fixture declares legacy Apple preferences instead of EPUB 3 rendition metadata. */
import { fixedFiles } from '../layout/fixed-fixture';

/** Keep vendor options explicit for parsing, precedence, and native fixed-spread tests. */
export function appleXml(
  options = '<option name="fixed-layout">true</option><option name="open-to-spread">true</option><option name="orientation-lock">landscape-only</option><option name="interactive">true</option>',
): string {
  return `<display_options><platform name="*">${options}</platform></display_options>`;
}

/** Preserve actual NCX navigation while replacing modern layout/spread metadata with an optional vendor file. */
export function appleFiles(source = appleXml()): Map<string, string> {
  const files = fixedFiles();
  const xml = (files.get('OPS/package.opf') ?? '')
    .replace('version="3.0"', 'version="2.0"')
    .replace(/<meta property="rendition:(?:layout|spread)">[^<]*<\/meta>/g, '')
    .replace(
      /<item id="nav"[^>]*\/>/,
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    )
    .replace('<spine ', '<spine toc="ncx" ');
  files.set('OPS/package.opf', xml);
  files.set('META-INF/com.apple.ibooks.display-options.xml', source);
  files.set(
    'OPS/p1.xhtml',
    (files.get('OPS/p1.xhtml') ?? '').replace(
      '</body>',
      '<script>window.appleInteractive=true;</script></body>',
    ),
  );
  return files;
}
