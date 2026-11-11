/** Annotation reload and host overlay input must work across Chromium, Firefox, and passive WebKit frames. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { interactionFiles } from '../browser/interaction/fixture';
import { writingFiles } from '../browser/render/writing-fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} annotations restore after chapter replacement`, async ({
    page,
  }) => {
    await page.route('**/annotations.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(interactionFiles())) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (seamless) => {
      const { runAnnotationScenario } = await import('../../tests/browser/annotations/scenario');
      return runAnnotationScenario(seamless);
    }, continuous);
    expect(result).toEqual({ stable: true, clipped: true, restored: true });
  });
}

for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    test(`annotation underline ${mode} ${direction} follows native text geometry`, async ({
      page,
    }) => {
      await page.route('**/annotation-writing.epub', (route) =>
        route.fulfill({ body: Buffer.from(bookZip(writingFiles(mode, direction))) }),
      );
      await page.goto('/examples/basic/');
      await expect(page.getByRole('status')).toContainText('已加载');
      const result = await page.evaluate(async () => {
        const { runAnnotationWriting } =
          await import('../../tests/browser/annotations/writing-scenario');
        return runAnnotationWriting();
      });
      expect(result.painted).toBe(true);
      expect(result.stable).toBe(true);
      expect(result.vertical).toBe(mode !== 'horizontal-tb');
    });
  }
}

test('host annotation buttons activate with real mouse and keyboard while frame scripts stay disabled', async ({
  page,
}) => {
  await page.route('**/annotations.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(interactionFiles())) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  await page.evaluate(async () => {
    const { mountAnnotationClick } = await import('../../tests/browser/annotations/scenario');
    await mountAnnotationClick();
  });
  const button = page.locator('#annotation-click-host').getByRole('button', { name: 'Open note' });
  await expect(page.locator('#annotation-click-host iframe')).toHaveAttribute(
    'sandbox',
    'allow-same-origin',
  );
  await button.click();
  await button.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  const clicks = await page.evaluate(async () => {
    const { annotationClicks, disposeAnnotationClick } =
      await import('../../tests/browser/annotations/scenario');
    const result = annotationClicks();
    disposeAnnotationClick();
    return result;
  });
  expect(clicks).toEqual(['payload', 'payload', 'payload']);
});
