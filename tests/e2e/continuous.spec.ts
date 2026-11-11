/** Continuous native chapter windows must preserve context and reading positions across browser engines. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { continuousFiles } from '../browser/continuous/fixture';

for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    test(`continuous ${mode} ${direction} retains anchors and bounds native views`, async ({
      page,
    }) => {
      await page.route('**/continuous.epub', (route) =>
        route.fulfill({
          body: Buffer.from(bookZip(continuousFiles(8, undefined, mode, direction))),
        }),
      );
      await page.goto('/examples/basic/');
      await expect(page.getByRole('status')).toContainText('已加载');
      const result = await page.evaluate(async () => {
        const { runContinuousScenario } = await import('../../tests/browser/continuous/scenario');
        return runContinuousScenario();
      });
      expect(result.axis).toBe(mode === 'horizontal-tb' ? 'vertical' : 'horizontal');
      expect(result.reverse).toBe(mode === 'vertical-rl');
      expect(Math.sign(result.native ?? 0)).toBe(mode === 'vertical-rl' ? -1 : 1);
      expect(result.retained).toBe(true);
      expect(result.stable).toBe(true);
      expect(result.atEnd, JSON.stringify(result)).toBe(true);
      expect(result.atStart).toBe(true);
      expect(result.bounded).toBe(true);
      expect(result.trimmed).toBe(true);
      expect(result.internal).toBe(true);
    });
  }
}
