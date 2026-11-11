/** Verify error-free library module loading in real browsers. */
import { expect, test } from '@playwright/test';
import { version } from '../../src/index';

/** The example displays the module version without page script errors. */
test('loads the library in the development example', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/examples/basic/');

  await expect(page).toHaveTitle('Folio 开发示例');
  await expect(page.getByRole('status')).toHaveText(`Folio v${version} 已加载`);
  expect(errors).toEqual([]);
});
