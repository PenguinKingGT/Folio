/** Native selection/CFI capture and passive hyperlink handling must agree across browser engines. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { interactionFiles } from '../browser/interaction/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} selections and explicit links preserve native identity`, async ({
    page,
  }) => {
    await page.route('**/interactions.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(interactionFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (seamless) => {
      const { runInteractionScenario } = await import('../../tests/browser/interaction/scenario');
      return runInteractionScenario(seamless);
    }, continuous);
    expect(result.text).toContain('😀');
    expect(result.restored).toBe(result.text);
    expect(result.chapter).toBe(2);
    expect(result.passive).toBe(true);
  });
}

test('a real outbound hyperlink click cannot navigate the passive publication iframe', async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://original.invalid/')) {
      outgoing.push(request.url());
    }
  });
  await page.route('**/interactions.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(interactionFiles())) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  await page.evaluate(async () => {
    const { mountClickReader } = await import('../../tests/browser/interaction/click-scenario');
    await mountClickReader();
  });
  await page
    .locator('#interaction-click-host')
    .frameLocator('iframe')
    .getByRole('link', { name: 'Outside', exact: true })
    .click();
  const state = await page.evaluate(async () => {
    const { clickReaderState, disposeClickReader } =
      await import('../../tests/browser/interaction/click-scenario');
    const result = clickReaderState();
    disposeClickReader();
    return result;
  });
  expect(state.same).toBe(true);
  expect(state.chapter).toBe(0);
  expect(state.href).toBeNull();
  expect(outgoing).toEqual([]);
});
