/** Chromium, Firefox, and WebKit render EPUB 2 Apple fixed-layout preferences through the shared passive pipeline. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { appleFiles } from '../unit/display-options/fixture';

test('legacy Apple preferences affect fixed geometry and spreads without enabling scripts', async ({
  page,
}) => {
  await page.route('**/apple-options.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(appleFiles())) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { runDisplayOptionsScenario } =
      await import('../../tests/browser/display-options/scenario');
    return runDisplayOptionsScenario();
  });
  expect(result).toEqual({
    fixed: true,
    spread: true,
    override: true,
    passive: true,
    advisory: true,
  });
});
