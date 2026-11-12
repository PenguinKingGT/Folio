/** Original EPUB 2/3 fixtures place OPF, TOC and encoded chapter paths in distinct directories for upstream #1367. */
import type { Book } from '../../../src/index';
import { bookFiles } from '../../unit/book/fixture';
import { nav, ncx, point } from '../../unit/navigation/fixture';
import { navigationChapter } from '../render/navigation-fixture';

/** Keep the package outside container root and resolve chapter links relative to the nested navigation document. */
export function nestedNavigationFiles(edition: '2' | '3'): Map<string, string> {
  const files = bookFiles(edition);
  const oldPath = edition === '3' ? 'nav.xhtml' : 'toc.ncx';
  const newPath = edition === '3' ? 'navigation/toc.xhtml' : 'navigation/toc.ncx';
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace(`href="${oldPath}"`, `href="${newPath}"`),
  );
  files.delete(`OPS/${oldPath}`);
  const href = '../text/chapter%20one.xhtml#end';
  files.set(
    `OPS/${newPath}`,
    edition === '3'
      ? nav(`<li><a href="${href}">Nested destination</a></li>`)
      : ncx(point('nested', href)),
  );
  files.set('OPS/text/chapter one.xhtml', navigationChapter());
  return files;
}

/** Follow the public explicit-base target contract instead of treating a TOC-relative URL as OPF-relative. */
export async function nestedNavigation(
  book: Book,
): Promise<{ index: number; visible: boolean; base: string }> {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(host);
  try {
    const href = book.navigation.toc[0]?.href;
    const navigation = book.publication.navPath ?? book.publication.ncxPath;
    if (href === null || href === undefined || navigation === null) {
      throw new Error('Expected a declared navigation destination.');
    }
    const address = book.resources.resolve(navigation);
    if (address.kind !== 'local') {
      throw new Error('Expected a local navigation document.');
    }
    const reader = book.renderTo(host);
    const section = await reader.display({ href, from: address.path });
    const target = reader.getContents()?.getElementById('end')?.getBoundingClientRect();
    return {
      index: section.index,
      base: address.path,
      visible: target !== undefined && target.right > 0 && target.left < reader.frame.clientWidth,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
