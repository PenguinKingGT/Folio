/** Inline PNG data remains readable through the complete archive-to-native-iframe asset pipeline. */
import { expect, test } from '@playwright/test';

test('Base64 image sources remain inline and decode at their original dimensions', async ({
  page,
}) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { inlineImageIdentity } = await import('../../tests/browser/issues/image-identity');
    return inlineImageIdentity();
  });
  expect(result).toEqual({ widths: [1, 2], retained: true, canonical: true });
});
