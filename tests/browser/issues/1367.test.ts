/** Upstream #1367: nested navigation targets resolve through the actual TOC document, not the OPF directory. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { nestedNavigation, nestedNavigationFiles } from './nested-navigation';

for (const edition of ['2', '3'] as const) {
  test(`navigates a nested EPUB ${edition} TOC to an encoded chapter and fragment`, async () => {
    const result = await nestedNavigation(await Book.open(bookZip(nestedNavigationFiles(edition))));
    expect(result).toEqual({
      index: 0,
      visible: true,
      base: edition === '3' ? 'OPS/navigation/toc.xhtml' : 'OPS/navigation/toc.ncx',
    });
  });
}
