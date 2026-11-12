/** Browser network-offline mode must still render both persisted ZIP and extracted-directory publications. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { bookFiles, bookZip } from '../unit/book/fixture';

for (const directory of [false, true]) {
  test(`${directory ? 'directory' : 'archive'} publication reopens across real offline/online transitions`, async ({
    page,
    context,
  }) => {
    const requests = await routePublication(page);
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    await page.evaluate(async (extracted) => {
      const { prepareOfflineScenario } = await import('../../tests/browser/offline/scenario');
      await prepareOfflineScenario(extracted);
    }, directory);
    const onlineRequests = requests();
    try {
      await context.setOffline(true);
      await expect
        .poll(() =>
          page.evaluate(async () =>
            (await import('../../tests/browser/offline/scenario')).offlineOnline(),
          ),
        )
        .toBe(false);
      const result = await page.evaluate(async () =>
        (await import('../../tests/browser/offline/scenario')).readOfflineScenario(),
      );
      expect(result).toEqual({
        offline: true,
        chapter: true,
        cover: true,
        passive: true,
        revoked: true,
      });
      expect(requests()).toBe(onlineRequests);
    } finally {
      await context.setOffline(false);
      await expect
        .poll(() =>
          page.evaluate(async () =>
            (await import('../../tests/browser/offline/scenario')).offlineOnline(),
          ),
        )
        .toBe(true);
      await page.evaluate(async () =>
        (await import('../../tests/browser/offline/scenario')).disposeOfflineScenario(),
      );
    }
  });
}

/** Count authored publication requests independently from Vite's normal application module traffic. */
async function routePublication(page: Page): Promise<() => number> {
  let requests = 0;
  const files = bookFiles();
  await page.route('**/offline-book.epub', (route) => {
    requests += 1;
    return route.fulfill({ body: Buffer.from(bookZip(files)) });
  });
  await page.route('**/offline-publication/**', (route) => {
    requests += 1;
    const path = decodeURIComponent(
      new URL(route.request().url()).pathname.replace('/offline-publication/', ''),
    );
    const body = files.get(path);
    return route.fulfill({ body: body ?? 'missing', status: body === undefined ? 404 : 200 });
  });
  return () => requests;
}
