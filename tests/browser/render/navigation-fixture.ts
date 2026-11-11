/** Original multi-chapter fixture with stable typography and named destinations. */
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';

/** Make enough body text to span several viewports in every supported engine. */
export function navigationChapter(): string {
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p{font:16px/20px monospace;margin:0}html{scroll-behavior:smooth}</style></head><body><p id="start">${'Original navigation text. '.repeat(200)}</p><p id="end">Final destination</p><a name="legacy">Legacy destination</a><p id="empty"/></body></html>`;
}

/** Insert a non-linear appendix between two linear chapters. */
export function navigationFiles(): Map<string, string> {
  const files = bookFiles();
  files.set('OPS/text/chapter one.xhtml', navigationChapter());
  files.set(
    'OPS/second.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>Second chapter</body></html>',
  );
  files.set(
    'OPS/appendix.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>Appendix</body></html>',
  );
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '')
      .replace(
        '</manifest>',
        '<item id="appendix" href="appendix.xhtml" media-type="application/xhtml+xml"/><item id="second" href="second.xhtml" media-type="application/xhtml+xml"/></manifest>',
      )
      .replace(
        '</spine>',
        '<itemref idref="appendix" linear="no"/><itemref idref="second"/></spine>',
      ),
  );
  return files;
}

/** Open the complete local fixture without network dependencies. */
export function navigationBook(): Promise<Book> {
  return Book.open(bookZip(navigationFiles()));
}
