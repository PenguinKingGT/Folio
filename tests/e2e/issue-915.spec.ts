/** Similar image filenames retain exact identity and independently decoded dimensions in every native engine. */
import { expect, test } from '@playwright/test';

test('17.3.png and 173.png decode from distinct exact resource paths', async ({ page }) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { imageIdentity } = await import('../../tests/browser/issues/image-identity');
    return imageIdentity();
  });
  expect(result).toEqual({ widths: [1, 2], distinct: true, exact: true });
});
