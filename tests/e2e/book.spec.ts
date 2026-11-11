/** Load an original EPUB through a browser-relative URL without creating a reader iframe. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';

test('opens, reads and destroys a headless publication in the browser', async ({ page }) => {
  await page.route('**/original.epub', (route) =>
    route.fulfill({
      contentType: 'application/epub+zip',
      body: Buffer.from(bookZip()),
    }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { Book } = await import('../../src/index');
    const book = await Book.open('/original.epub');
    const title = book.publication.metadata.title;
    const chapter = await book.section()?.render();
    const directory = book.navigation.toc.length;
    const iframes = document.querySelectorAll('iframe').length;
    book.destroy();
    return { title, chapter, directory, iframes };
  });
  expect(result.title).toBe('Original title');
  expect(result.chapter).toContain('Original chapter text');
  expect(result.directory).toBe(1);
  expect(result.iframes).toBe(0);
});
