/** Native image identity is independent of leading digits and hyphens in manifest resource identifiers. */
import { expect, test } from '@playwright/test';

test('leading-digit manifest IDs retain exact native image identity', async ({ page }) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { imageIdentity } = await import('../../tests/browser/issues/image-identity');
    return imageIdentity(true);
  });
  expect(result).toEqual({ widths: [1, 2], distinct: true, exact: true });
});
