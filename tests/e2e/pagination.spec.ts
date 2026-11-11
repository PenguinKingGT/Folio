/** Real browser column geometry and final spread reachability across Chromium, Firefox and WebKit. */
import { expect, test } from '@playwright/test';
import { bookFiles, bookZip } from '../unit/book/fixture';

test('lays out double columns and preserves the final page scroll target', async ({ page }) => {
  const files = bookFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p{font:16px/20px monospace;margin:0}</style></head><body><p>${'Original paginated text. '.repeat(300)}</p></body></html>`,
  );
  await page.route('**/pagination.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(files)), contentType: 'application/epub+zip' }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { Book } = await import('../../src/index');
    const host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const book = await Book.open('/pagination.epub');
    const reader = book.renderTo(host, { spread: 'always', gap: 20 });
    await reader.display();
    const metrics = reader.pagination;
    const contents = reader.getContents();
    if (metrics === null || contents?.defaultView === null || contents === null) {
      throw new Error('Missing pagination metrics.');
    }
    const target = (metrics.pageCount - 1) * metrics.advance;
    contents.defaultView.scrollTo(target, 0);
    const actual = contents.defaultView.scrollX;
    const columns = contents.body.style.columnCount;
    book.destroy();
    host.remove();
    return { metrics, target, actual, columns };
  });
  expect(result.metrics.pageCount).toBeGreaterThan(1);
  expect(result.metrics.columnWidth).toBe(310);
  expect(result.columns).toBe('2');
  expect(Math.abs(result.target - result.actual)).toBeLessThanOrEqual(1);
});
