/** Async host hooks and custom native view/manager factories work in Chromium, Firefox, and WebKit. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { interactionFiles } from '../browser/interaction/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} extensions await decoration and native unload`, async ({
    page,
  }) => {
    await page.route('**/extensions.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(interactionFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (seamless) => {
      const { runExtensionScenario } = await import('../../tests/browser/extensions/scenario');
      return runExtensionScenario(seamless);
    }, continuous);
    expect(result).toEqual({ decorated: true, custom: true, cleaned: true, drained: true });
  });
}
