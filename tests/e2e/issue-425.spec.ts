/** Repeated native book teardown releases source attributes and URLs even when host code retains iframe references. */
import { expect, test } from '@playwright/test';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} repeated teardown releases source markup and URLs`, async ({
    page,
  }) => {
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (seamless) => {
      const { repeatedClose } = await import('../../tests/browser/issues/repeated-close');
      return repeatedClose(seamless);
    }, continuous);
    expect(result).toEqual({ cycles: 8, frames: true, sources: true, urls: true });
  });
}
