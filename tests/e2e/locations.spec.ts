/** Generated headless progress and persisted snapshots must resolve against each browser's reader DOM. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';

test('generates, saves and resolves reading locations in a rendered chapter', async ({ page }) => {
  await page.route('**/locations.epub', (route) => route.fulfill({ body: Buffer.from(bookZip()) }));
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { Book, rangeFromCfi } = await import('../../src/index');
    const book = await Book.open('/locations.epub');
    const entries = await book.locations.generate({ breakSize: 4 });
    const host = document.createElement('div');
    host.style.width = '320px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const reader = book.renderTo(host);
    await reader.display();
    const contents = reader.getContents();
    if (contents === null) {
      throw new Error('Missing chapter.');
    }
    const resolved = entries.every(
      (entry) => rangeFromCfi(contents, entry.cfi).startContainer.nodeType === 3,
    );
    book.locations.setCurrent(entries.length - 1);
    book.locations.load(book.locations.save());
    const percent = book.locations.percentageFromLocation(book.locations.current ?? -1);
    book.destroy();
    host.remove();
    return { resolved, percent, count: entries.length };
  });
  expect(result.resolved).toBe(true);
  expect(result.percent).toBe(1);
  expect(result.count).toBeGreaterThan(2);
});
