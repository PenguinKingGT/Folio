/** Verify native vertical and horizontal chapter scrolling in every supported browser engine. */
import { expect, test } from '@playwright/test';
import { bookFiles, bookZip } from '../unit/book/fixture';

test('switches native scrolling axes without retaining incompatible column rules', async ({
  page,
}) => {
  const files = bookFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>${'Original scrolling chapter. '.repeat(250)}</p></body></html>`,
  );
  await page.route('**/flow.epub', (route) => route.fulfill({ body: Buffer.from(bookZip(files)) }));
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { Book } = await import('../../src/index');
    const host = document.createElement('div');
    host.style.width = '320px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const book = await Book.open('/flow.epub');
    const reader = book.renderTo(host, { flow: 'scrolled-doc' });
    await reader.display();
    const contents = reader.getContents();
    if (contents?.defaultView === null || contents === null) {
      throw new Error('Missing scrolling document.');
    }
    contents.defaultView.scrollTo(0, 100);
    const y = contents.defaultView.scrollY;
    const vertical = reader.flowState;
    reader.flow('scrolled-continuous', 'horizontal');
    contents.defaultView.scrollTo(100, 0);
    const x = contents.defaultView.scrollX;
    const horizontal = reader.flowState;
    reader.flow('paginated');
    const paginated = reader.pagination?.pageCount;
    book.destroy();
    host.remove();
    return { y, x, vertical, horizontal, paginated };
  });
  expect(result.y).toBe(100);
  expect(result.x).toBe(100);
  expect(result.vertical?.axis).toBe('vertical');
  expect(result.horizontal?.axis).toBe('horizontal');
  expect(result.paginated).toBeGreaterThan(1);
});
