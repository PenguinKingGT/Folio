/** Verify touch-aware pagination across engines and real mobile contact dispatch in Chromium. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { writingFiles } from '../browser/render/writing-fixture';

for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    test(`touch ${mode} ${direction} turns and snaps along the inline axis`, async ({ page }) => {
      await page.route('**/touch.epub', (route) =>
        route.fulfill({ body: Buffer.from(bookZip(writingFiles(mode, direction))) }),
      );
      await page.goto('/examples/basic/');
      await expect(page.getByRole('status')).toContainText('已加载');
      const result = await page.evaluate(async () => {
        const { runTouchScenario } = await import('../../tests/browser/touch/scenario');
        return runTouchScenario();
      });
      expect(result.page).toBe(2);
      expect(result.snapped).toBe(true);
      expect(result.restored).toBe(true);
      expect(result.passiveScripts).toBe(true);
    });
  }
}
