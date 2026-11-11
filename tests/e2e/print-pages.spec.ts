/** Printed-page destinations must resolve to passive native elements in all browser engines. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { pageFiles } from '../unit/pages/fixture';

for (const edition of ['2', '3'] as const) {
  test(`navigates EPUB ${edition} printed labels through generated element CFIs`, async ({
    page,
  }) => {
    await page.route('**/print-pages.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(pageFiles(edition))) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async () => {
      const { Book, rangeFromCfi } = await import('../../src/index');
      const book = await Book.open('/print-pages.epub');
      const host = document.createElement('div');
      host.style.width = '320px';
      host.style.height = '240px';
      document.body.appendChild(host);
      try {
        await book.pageList.generate();
        const reader = book.renderTo(host);
        await reader.display(book.pageList.cfiFromPage(1) ?? '');
        const contents = reader.getContents();
        if (!contents) {
          throw new Error('Missing print-page contents.');
        }
        const ids = book.pageList.entries.map((entry) => {
          const node = rangeFromCfi(contents, entry.cfi ?? '').startContainer;
          return node.nodeType === 1 && 'id' in node ? node.id : null;
        });
        return {
          ids,
          labels: book.pageList.entries.map(
            (entry) => book.pageList.pageFromCfi(entry.cfi ?? '')?.label,
          ),
          percentage: book.pageList.percentageFromPage(1),
        };
      } finally {
        book.destroy();
        host.remove();
      }
    });
    expect(result.ids).toEqual(['body', 'p[1]', 'p2']);
    expect(result.labels).toEqual(['iv', '1', '3']);
    expect(result.percentage).toBe(0.5);
  });
}
