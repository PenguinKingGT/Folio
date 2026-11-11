/** Original theme fixtures exercise new chapters, imports, native geometry, and independent reader state. */
import { Book, Cfi } from '../../../src/index';
import type { VisibleLocation } from '../../../src/index';
import { continuousFiles } from '../continuous/fixture';
import { bookZip } from '../../unit/book/fixture';
import { host } from '../render/fixture';

/** Add a named stylesheet and conditionally imported rules to the original reading-order fixture. */
export function themeFiles(): Map<string, string> {
  const files = continuousFiles();
  files.set(
    'OPS/themes/night.css',
    '@import "colors.css" screen;body{background-color:rgb(10,20,30)}p{font-size:24px}',
  );
  files.set('OPS/themes/colors.css', 'p{color:rgb(230,240,250)}');
  return files;
}

/** Attach an original publication and provide deterministic ownership cleanup. */
export async function themedBook(): Promise<{
  book: Book;
  container: HTMLDivElement;
  release: () => void;
}> {
  const book = await Book.open(bookZip(themeFiles()));
  const container = host();
  return {
    book,
    container,
    release: () => {
      book.destroy();
      container.remove();
    },
  };
}

/** Compare logical book boundaries without depending on a browser's glyph or caret metrics. */
export function contains(location: VisibleLocation | null, cfi: string): boolean {
  return (
    location !== null &&
    new Cfi(location.start.cfi).compare(new Cfi(cfi)) <= 0 &&
    new Cfi(location.end.cfi).compare(new Cfi(cfi)) >= 0
  );
}
