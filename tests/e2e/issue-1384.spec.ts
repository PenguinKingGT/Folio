/** Upstream #1384 is checked in three engines with native ResizeObserver and real pending iframe preparation. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { navigationFiles } from '../browser/render/navigation-fixture';

for (const phase of ['content', 'render'] as const) {
  test(`initial resize preserves the destination during ${phase} preparation`, async ({ page }) => {
    await page.route('**/issue-1384.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(navigationFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (stage) => {
      const { Book } = await import('../../src/index');
      const { runInitialResize } = await import('../../tests/browser/issues/initial-resize');
      return runInitialResize(await Book.open('/issue-1384.epub'), stage);
    }, phase);
    expect(result).toEqual({
      initial: 500,
      visible: true,
      width: 640,
      retained: true,
      destination: true,
    });
  });
}
