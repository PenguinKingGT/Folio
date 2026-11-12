/** Native scroll reversal and delayed predecessor measurement retain anchors across desktop engines and mobile Chromium emulation. */
import { expect, test } from '@playwright/test';

test('a delayed predecessor cannot overwrite the newest upward scroll destination', async ({
  page,
}) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { scrollReversal } = await import('../../tests/browser/issues/scroll-reversal');
    return scrollReversal();
  });
  expect(result).toEqual({
    section: 3,
    retained: true,
    settled: true,
    bounded: true,
    error: false,
  });
});
