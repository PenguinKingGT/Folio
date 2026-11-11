/** 验证真实浏览器能够加载库入口，且加载过程无页面错误。 */
import { expect, test } from '@playwright/test';
import { version } from '../../src/index';

/** 示例中的版本应来自库模块，页面应在无脚本异常的情况下完成加载。 */
test('loads the library in the development example', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/examples/basic/');

  await expect(page).toHaveTitle('Folio 开发示例');
  await expect(page.getByRole('status')).toHaveText(`Folio v${version} 已加载`);
  expect(errors).toEqual([]);
});
