/** Empty-subset XHTML loads in all native engines while passive/scripted permissions remain distinct. */
import { expect, test } from '@playwright/test';

for (const scripted of [false, true]) {
  test(`${scripted ? 'scripted' : 'passive'} inert empty doctype renders with the expected sandbox`, async ({
    page,
  }) => {
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (execute) => {
      const { inertDoctype } = await import('../../tests/browser/issues/inert-doctype');
      return inertDoctype(execute);
    }, scripted);
    expect(result).toEqual({ readable: true, isolated: true });
  });
}
