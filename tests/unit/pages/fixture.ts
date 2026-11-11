/** Original print-page links and EPUB 2/3 publications under the Folio license. */
import type { PrintPageLink } from '../../../src/index';
import { bookFiles } from '../book/fixture';
import { nav, ncx, point } from '../navigation/fixture';

/** Build a point CFI suitable for independent ordered-index tests. */
export function cfi(offset: number): string {
  return `epubcfi(/6/2[chapter]!/4/2/1:${offset})`;
}

/** Create a typed original link with a retained human-readable page label. */
export function link(label: string, href = `#${cfi(10)}`): PrintPageLink {
  return { id: null, label, href, type: null };
}

/** Generate a complete publication whose page-list base differs from the package directory. */
export function pageFiles(edition: '2' | '3' = '3'): Map<string, string> {
  const files = bookFiles(edition);
  const chapter =
    '<html xmlns="http://www.w3.org/1999/xhtml"><body id="body"><script>bad</script><p>Original preface</p><span id="p[1]"/><p>First printed page</p><meta http-equiv="refresh" content="0"/><span id="p2"/><p>Second printed page</p></body></html>';
  files.set('OPS/text/chapter one.xhtml', chapter);
  const hrefs = [
    '../text/chapter%20one.xhtml',
    '../text/chapter%20one.xhtml#p%5B1%5D',
    '../text/chapter%20one.xhtml#p2',
  ];
  const labels = ['iv', '1', '3'];
  if (edition === '3') {
    files.set(
      'OPS/package.opf',
      (files.get('OPS/package.opf') ?? '').replace('href="nav.xhtml"', 'href="nav/pages.xhtml"'),
    );
    files.set(
      'OPS/nav/pages.xhtml',
      nav(
        '<li><a href="../text/chapter%20one.xhtml">Chapter</a></li>',
        `<nav epub:type="page-list"><ol>${hrefs.map((href, index) => `<li id="page-${index}"><a href="${href}">${labels[index]}</a></li>`).join('')}</ol></nav>`,
      ),
    );
  } else {
    files.set(
      'OPS/package.opf',
      (files.get('OPS/package.opf') ?? '').replace('href="toc.ncx"', 'href="nav/pages.ncx"'),
    );
    files.set(
      'OPS/nav/pages.ncx',
      ncx(point('chapter-nav', '../text/chapter%20one.xhtml')).replace(
        '</ncx>',
        `<pageList>${hrefs.map((href, index) => `<pageTarget id="page-${index}" type="normal"><navLabel><text>${labels[index]}</text></navLabel><content src="${href}"/></pageTarget>`).join('')}</pageList></ncx>`,
      ),
    );
  }
  return files;
}
