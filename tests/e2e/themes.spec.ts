/** Theme loading and font reflow must preserve the same CFI across native browser engines. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { themeFiles } from '../browser/themes/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} themes retain reading positions and future chapter styles`, async ({
    page,
  }) => {
    await page.route('**/themes.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(themeFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (seamless) => {
      const { runThemeScenario } = await import('../../tests/browser/themes/scenario');
      return runThemeScenario(seamless);
    }, continuous);
    expect(result.preserved).toBe(true);
    expect(result.current).toBe('night');
    expect(result.color).toBe('rgb(230, 240, 250)');
    expect(result.styles).toBe(1);
  });
}
