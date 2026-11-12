/** Opaque script execution and independently authorized popups work across Chromium, Firefox and WebKit. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { scriptedFiles } from '../browser/scripted/fixture';

/** Read native protocol results without accessing publication DOM from the application. */
async function messages(page: Page): Promise<readonly unknown[]> {
  return page.evaluate(async () =>
    (await import('../../tests/browser/scripted/scenario')).scriptedMessages(),
  );
}

for (const popups of [false, true]) {
  test(`scripted opaque view ${popups ? 'permits authorized' : 'blocks unauthorized'} popup gestures`, async ({
    page,
  }) => {
    await page.route('**/scripted.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(scriptedFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    try {
      const result = await page.evaluate(async (allowed) => {
        const { mountScriptedScenario } = await import('../../tests/browser/scripted/scenario');
        return mountScriptedScenario(allowed);
      }, popups);
      expect(result.opaque).toBe(true);
      expect(result.isolated).toBe(true);
      expect(result.sandbox).toBe(popups ? 'allow-scripts allow-popups' : 'allow-scripts');
      expect(result.messages).toContainEqual(
        expect.objectContaining({
          kind: 'executed',
          order: ['injected-first', 'injected-second', 'inline', 'external'],
          denied: true,
          name: 'Folio',
          dom: true,
          spine: true,
          color: 'rgb(1, 2, 3)',
          weight: '700',
        }),
      );
      await activatePopup(page, popups);
      await expect.poll(() => messages(page)).toContainEqual({ kind: 'popup', allowed: popups });
      expect(
        await page.evaluate(async () =>
          (await import('../../tests/browser/scripted/scenario')).scriptedFailure(),
        ),
      ).toBeNull();
    } finally {
      await page.evaluate(async () =>
        (await import('../../tests/browser/scripted/scenario')).disposeScriptedScenario(),
      );
    }
  });
}

/** User activation exercises the browser popup policy without bypassing the opaque publication DOM. */
async function activatePopup(page: Page, popups: boolean): Promise<void> {
  const button = page
    .frameLocator('#scripted-host iframe')
    .getByRole('button', { name: 'Open local popup' });
  if (popups) {
    const popup = page.waitForEvent('popup');
    await button.click();
    const opened = await popup;
    expect(opened.url()).toBe('about:blank');
    await opened.close();
  } else {
    await button.click();
  }
}
