/** Original browser rendering fixtures; books and host elements are explicitly cleaned up. */
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';

/** Attach a visible, fixed-size host to the real runner document. */
export function host(): HTMLDivElement {
  const result = document.createElement('div');
  result.style.width = '320px';
  result.style.height = '240px';
  document.body.appendChild(result);
  return result;
}

/** Open a local original book, optionally replacing its chapter markup. */
export async function book(chapter?: string): Promise<Book> {
  const files = bookFiles();
  if (chapter !== undefined) {
    files.set('OPS/text/chapter one.xhtml', chapter);
  }
  return Book.open(bookZip(files));
}

/** Open two chapters while deterministically holding the first chapter response. */
export async function delayedBook(): Promise<{ publication: Book; release: () => void }> {
  const files = bookFiles();
  const packageXml = (files.get('OPS/package.opf') ?? '')
    .replace(
      '</manifest>',
      '<item id="second" href="second.xhtml" media-type="application/xhtml+xml"/></manifest>',
    )
    .replace('</spine>', '<itemref idref="second"/></spine>');
  files.set('OPS/package.opf', packageXml);
  files.set(
    'OPS/second.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>Second chapter</body></html>',
  );
  let finish: ((value: Response) => void) | undefined;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const publication = await Book.open('https://original.invalid/OPS/package.opf', {
    fetch: (input) => {
      const url = input instanceof Request ? input.url : input;
      const path = decodeURIComponent(new URL(url).pathname.slice(1));
      if (path === 'OPS/text/chapter one.xhtml') {
        return pending;
      }
      return Promise.resolve(
        new Response(files.get(path) ?? 'missing', { status: files.has(path) ? 200 : 404 }),
      );
    },
  });
  return {
    publication,
    release: () => finish?.(new Response(files.get('OPS/text/chapter one.xhtml'))),
  };
}

/** A complete original XHTML chapter suitable for direct iframe loading. */
export const xhtml =
  '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original chapter</p></body></html>';
