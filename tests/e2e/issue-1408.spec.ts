/** Desktop engines and mobile Chromium emulation preserve a distant continuous target after late content and native reflow. */
import { expect, test } from '@playwright/test';

test('late loading and predecessor geometry retain the committed distant destination', async ({
  page,
}) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { lateNavigation } = await import('../../tests/browser/issues/late-navigation');
    return lateNavigation();
  });
  expect(result).toEqual({
    cancelled: true,
    section: 8,
    retained: true,
    measured: true,
    bounded: true,
    error: false,
  });
});
