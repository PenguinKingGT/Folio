/** Headless print-page CFIs must resolve to the exact native passive DOM elements. */
import { expect, test } from 'vitest';
import { Book, rangeFromCfi } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { pageFiles } from '../../unit/pages/fixture';
import { host } from './fixture';

for (const edition of ['2', '3'] as const) {
  test(`resolves EPUB ${edition} page markers after scripts/refresh nodes and missing-head normalization`, async () => {
    const publication = await Book.open(bookZip(pageFiles(edition)));
    const container = host();
    try {
      const pages = await publication.pageList.generate();
      expect(container.querySelector('iframe')).toBeNull();
      const reader = publication.renderTo(container);
      for (const page of pages) {
        await reader.display(page.cfi ?? '');
        const contents = reader.getContents();
        if (!contents) {
          throw new Error('Missing printed-page document.');
        }
        const range = rangeFromCfi(contents, page.cfi ?? '');
        expect(range.startContainer).toBe(
          page.index === 0
            ? contents.body
            : contents.getElementById(page.index === 1 ? 'p[1]' : 'p2'),
        );
        expect(publication.pageList.pageFromCfi(page.cfi ?? '')?.label).toBe(page.label);
        expect(contents.querySelector('script,meta[http-equiv="refresh"]')).toBeNull();
      }
    } finally {
      publication.destroy();
      container.remove();
    }
  });
}
