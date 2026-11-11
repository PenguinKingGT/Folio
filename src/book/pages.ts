/** Bind printed-page links to local spine documents while keeping generation independent of browser DOM. */
import type { Book } from './book';
import { Cfi } from '../cfi/cfi';
import { escapeCfi } from '../cfi/syntax';
import { elementCfi } from '../pages/element-cfi';
import { PageList } from '../pages/page-list';
import type { PrintPage } from '../pages/types';

/** Validate direct page CFIs against the current package's actual spine identity. */
function direct(book: Book, value: string): string {
  const cfi = new Cfi(value);
  const section = book.section(value);
  if (
    section === null ||
    cfi.data.paths.length !== 2 ||
    cfi.data.paths[0]?.steps[0]?.value !== book.publication.spineStep ||
    cfi.spineIndex !== section.index ||
    (cfi.spineId !== null && cfi.spineId !== section.idref)
  ) {
    throw new TypeError('Print-page CFI does not identify a current spine document.');
  }
  return cfi.toString();
}

/** Resolve page fragments relative to the declared navigation document, not the OPF. */
async function resolvePage(book: Book, page: PrintPage, signal: AbortSignal): Promise<string> {
  if (page.cfi !== null) {
    return direct(book, page.cfi);
  }
  const href = book.publication.navPath ?? book.publication.ncxPath;
  const navigation = book.resources.resolve(href ?? '', book.packagePath);
  const base = navigation.kind === 'local' ? navigation.path : book.packagePath;
  const address = book.resources.resolve(page.href, base);
  if (address.kind !== 'local' && address.kind !== 'fragment') {
    throw new TypeError('Print pages require local spine destinations.');
  }
  const path = address.kind === 'local' ? address.path : base;
  const section = book.spine.all().find((item) => {
    const candidate = book.resources.resolve(item.href);
    return candidate.kind === 'local' && candidate.path === path;
  });
  if (section === undefined) {
    throw new RangeError('Print-page destination is not in the spine.');
  }
  const fragment = address.kind === 'local' ? address.fragment : address.url;
  const document = await section.load(signal);
  signal.throwIfAborted();
  const packagePath = `/${book.publication.spineStep}/${(section.index + 1) * 2}[${escapeCfi(section.idref)}]`;
  return elementCfi(document, decodeURIComponent(fragment.slice(1)), packagePath);
}

/** Construct a lazy page index; opening a book still does not read chapter content. */
export function createPageList(book: Book): PageList {
  const pages = new PageList(book.navigation.pages, (page, signal) =>
    resolvePage(book, page, signal),
  );
  for (const page of pages.entries) {
    if (page.cfi !== null) {
      direct(book, page.cfi);
    }
  }
  return pages;
}
