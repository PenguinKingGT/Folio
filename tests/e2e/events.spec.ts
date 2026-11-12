/** Typed subscriptions and lifecycle guarantees hold across both readers and all three native engines. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { interactionFiles } from '../browser/interaction/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} typed reader events support native reading and cleanup`, async ({
    page,
  }) => {
    await page.route('**/events.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(interactionFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (seamless) => {
      const { runEventsScenario } = await import('../../tests/browser/events/scenario');
      return runEventsScenario(seamless);
    }, continuous);
    expect(result).toEqual({ interactions: true, lifecycle: true, failures: true, cleaned: true });
  });
}
