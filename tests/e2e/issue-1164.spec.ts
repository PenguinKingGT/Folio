/** Native wheel scrolling must clip and restore highlights without host-side repair calls. */
import { expect, test } from '@playwright/test';

test('passive native wheel scrolling updates annotation geometry and relocation events', async ({
  page,
}) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  try {
    await page.evaluate(async () =>
      (
        await import('../../tests/browser/issues/native-annotation-scroll')
      ).mountNativeAnnotationScroll(),
    );
    const state = () =>
      page.evaluate(async () =>
        (
          await import('../../tests/browser/issues/native-annotation-scroll')
        ).nativeAnnotationScrollState(),
      );
    expect((await state()).paint).toBeGreaterThan(0);
    await page.mouse.move(80, 80);
    await page.mouse.wheel(0, 500);
    await expect.poll(async () => (await state()).scroll).toBeGreaterThan(100);
    await expect.poll(async () => (await state()).events).toBeGreaterThan(0);
    await expect.poll(async () => (await state()).paint).toBe(0);
    await page.mouse.wheel(0, -1000);
    await expect.poll(async () => (await state()).scroll).toBe(0);
    await expect.poll(async () => (await state()).paint).toBeGreaterThan(0);
  } finally {
    await page.evaluate(async () =>
      (
        await import('../../tests/browser/issues/native-annotation-scroll')
      ).disposeNativeAnnotationScroll(),
    );
  }
});

test('continuous native scrolling restores highlights after their original chapter frame is trimmed', async ({
  page,
}) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  try {
    await page.evaluate(async () =>
      (
        await import('../../tests/browser/issues/native-annotation-scroll')
      ).mountNativeAnnotationScroll(true),
    );
    const state = () =>
      page.evaluate(async () =>
        (
          await import('../../tests/browser/issues/native-annotation-scroll')
        ).nativeAnnotationScrollState(),
      );
    expect((await state()).paint).toBeGreaterThan(0);
    await page.mouse.move(80, 80);
    await page.mouse.wheel(0, 100_000);
    await expect.poll(async () => (await state()).firstLoaded).toBe(false);
    await expect.poll(async () => (await state()).paint).toBe(0);
    await page.mouse.wheel(0, -100_000);
    await expect.poll(async () => (await state()).scroll).toBe(0);
    await expect.poll(async () => (await state()).firstLoaded).toBe(true);
    await expect.poll(async () => (await state()).paint).toBeGreaterThan(0);
  } finally {
    await page.evaluate(async () =>
      (
        await import('../../tests/browser/issues/native-annotation-scroll')
      ).disposeNativeAnnotationScroll(),
    );
  }
});
