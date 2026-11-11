/** Visible locations must advance and resolve to native text in all browser engines. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { navigationFiles } from '../browser/render/navigation-fixture';

test('reports actual visible CFIs, page numbers, progress, and relocated snapshots', async ({
  page,
}) => {
  await page.route('**/visible.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(navigationFiles())) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await readPositions(page);
  expect(result.first?.atStart).toBe(true);
  expect(result.next?.start.displayed.page).toBe(2);
  expect(result.next?.start.percentage).toBeGreaterThan(0);
  expect(result.offset).toBeGreaterThan(0);
  expect(result.last?.atEnd).toBe(true);
  expect(result.pages).toEqual([1, 2, 1]);
});

/** Read positions in the reader realm and clean up before crossing the protocol boundary. */
function readPositions(page: Page) {
  return page.evaluate(async () => {
    const { Book, rangeFromCfi } = await import('../../src/index');
    const host = document.createElement('div');
    host.style.width = '320px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const book = await Book.open('/visible.epub');
    const reader = book.renderTo(host);
    const pages: number[] = [];
    reader.onRelocated((location) => pages.push(location.start.displayed.page));
    try {
      await book.locations.generate({ breakSize: 10 });
      await reader.display();
      const first = reader.currentLocation();
      await reader.next();
      const next = reader.currentLocation();
      const contents = reader.getContents();
      if (next === null || contents === null) {
        throw new Error('Missing visible position.');
      }
      const offset = rangeFromCfi(contents, next.start.cfi).startOffset;
      await reader.display(2);
      return { first, next, offset, last: reader.currentLocation(), pages };
    } finally {
      book.destroy();
      host.remove();
    }
  });
}
