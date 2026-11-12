/** Cross-engine backward chapter transitions retain the final page after relative font reflow. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { navigationFiles } from '../browser/render/navigation-fixture';

for (const size of ['80%', '120%'] as const) {
  test(`previous/next preserve chapter boundaries after font size ${size}`, async ({ page }) => {
    await page.route('**/issue-1326.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(navigationFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (fontSize) => {
      const { Book } = await import('../../src/index');
      const { fontBoundary } = await import('../../tests/browser/issues/font-boundary');
      return fontBoundary(await Book.open('/issue-1326.epub'), fontSize);
    }, size);
    expect(result.font).toBeCloseTo(size === '80%' ? 12.8 : 19.2, 1);
    expect(result).toMatchObject({ previous: 0, finalVisible: true, next: 2 });
  });
}
