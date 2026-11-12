/** Real native navigation follows nested EPUB 2/3 TOC references with explicit source-document identity. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { nestedNavigationFiles } from '../browser/issues/nested-navigation';

for (const edition of ['2', '3'] as const) {
  test(`EPUB ${edition} nested TOC resolves an encoded chapter fragment`, async ({ page }) => {
    await page.route('**/issue-1367.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(nestedNavigationFiles(edition))) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async () => {
      const { Book } = await import('../../src/index');
      const { nestedNavigation } = await import('../../tests/browser/issues/nested-navigation');
      return nestedNavigation(await Book.open('/issue-1367.epub'));
    });
    expect(result).toEqual({
      index: 0,
      visible: true,
      base: edition === '3' ? 'OPS/navigation/toc.xhtml' : 'OPS/navigation/toc.ncx',
    });
  });
}
