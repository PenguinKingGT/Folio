/** Fixed pages keep native coordinates and gapless physical spreads across all browser engines. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { fixedFiles } from '../unit/layout/fixed-fixture';

for (const direction of ['ltr', 'rtl'] as const) {
  test(`renders and resizes native ${direction} fixed-layout spreads`, async ({ page }) => {
    await page.route('**/fixed.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(fixedFiles([], direction))) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async () => {
      const { runFixedScenario } = await import('../../tests/browser/render/fixed-scenario');
      return runFixedScenario();
    });
    expect(result.gap).toBe(0);
    expect(result.indices).toEqual([1, 2]);
    expect(result.sides).toEqual(direction === 'ltr' ? ['left', 'right'] : ['right', 'left']);
    expect(result.native).toEqual([600, 800, 300, 400]);
    expect(result.boundaries).toEqual([1, 2]);
    expect(result.next).toBe(3);
    expect(result.scale).toBe(0.5);
    expect(result.pages).toBe(1);
  });
}
