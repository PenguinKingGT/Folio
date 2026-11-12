/** Every native engine completes lifecycle cleanup across broken views, asynchronous hooks, and cancelled render staging. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { fixedFiles } from '../unit/layout/fixed-fixture';
import { continuousFiles } from '../browser/continuous/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'fixed bounded'} destruction preserves every independent cleanup phase`, async ({
    page,
  }) => {
    await page.route('**/lifecycle.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(continuous ? continuousFiles(4) : fixedFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(
      async (seamless) =>
        (await import('../../tests/browser/lifecycle/scenario')).runCleanupScenario(seamless),
      continuous,
    );
    expect(result).toEqual({
      allViews: true,
      cleared: true,
      errors: true,
      state: 'destroyed',
      ended: 1,
    });
  });
}

test('async book closure includes unload work queued by cancelled native render preparation', async ({
  page,
}) => {
  await page.route('**/lifecycle.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(continuousFiles(4))) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () =>
    (await import('../../tests/browser/lifecycle/scenario')).runCancelledCloseScenario(),
  );
  expect(result).toEqual({ unloaded: true, state: 'destroyed', cleared: true });
});
