/** Native engines must show oversized artwork completely at the requested chapter fragment. */
import { expect, test } from '@playwright/test';

for (const writingMode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    test(`oversized artwork fits ${writingMode} ${direction} reading pages`, async ({ page }) => {
      await page.goto('/examples/basic/');
      await expect(page.getByRole('status')).toContainText('已加载');
      const result = await page.evaluate(
        async (options) =>
          (await import('../../tests/browser/issues/large-media')).largeMediaScenario(options),
        { writingMode, direction },
      );
      expect(Math.abs(result.scroll)).toBeGreaterThan(0);
      expect(result.width).toBeLessThanOrEqual(320);
      expect(result.height).toBeLessThanOrEqual(240);
      expect(result.left).toBeGreaterThanOrEqual(0);
      expect(result.left + result.width).toBeLessThanOrEqual(320);
      expect(result.top).toBeGreaterThanOrEqual(0);
      expect(result.top + result.height).toBeLessThanOrEqual(240);
      expect(result.attributes).toEqual(['1000', '2000']);
    });
  }
}
