/** Real Chromium mobile contacts verify pointer delivery inside script-disabled native chapter frames. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { writingFiles } from '../browser/render/writing-fixture';

test('real mobile contacts turn a passive chapter exactly once', async ({ page, context }) => {
  await page.route('**/touch.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(writingFiles('horizontal-tb', 'ltr'))) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const point = await page.evaluate(async () => {
    const { mountMobileReader } = await import('../../tests/browser/touch/mobile-scenario');
    return mountMobileReader();
  });
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...point, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: point.x - 100, y: point.y, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { mobilePage } = await import('../../tests/browser/touch/mobile-scenario');
        return mobilePage();
      }),
    )
    .toBe(2);
  await page.evaluate(async () => {
    const { disposeMobileReader } = await import('../../tests/browser/touch/mobile-scenario');
    disposeMobileReader();
  });
});
