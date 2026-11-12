/** Real HTTP chapter requests overlap before release and still produce a deterministic headless location index. */
import { expect, test } from '@playwright/test';
import { manyPackage } from '../unit/locations/concurrency-fixture';
import { gate } from '../unit/extensions/fixture';
import { chapter } from '../unit/locations/fixture';

test('bounded parallel chapter downloads preserve ordered locations without creating reader frames', async ({
  page,
}) => {
  const release = gate();
  const requested: string[] = [];
  await page.route('**/parallel-1405/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('package.opf')) {
      await route.fulfill({ body: manyPackage(3), contentType: 'application/oebps-package+xml' });
      return;
    }
    requested.push(path);
    await release.promise;
    await route.fulfill({
      body: chapter(`<p>Original ${path} text.</p>`),
      contentType: 'application/xhtml+xml',
    });
  });
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const operation = page.evaluate(async () => {
    const { parallelLocations } = await import('../../tests/browser/issues/parallel-locations');
    return parallelLocations('/parallel-1405/OPS/package.opf');
  });
  const settled = Promise.allSettled([operation]);

  try {
    await expect.poll(() => requested.length).toBe(2);
    expect(new Set(requested)).toEqual(
      new Set(['/parallel-1405/OPS/c0.xhtml', '/parallel-1405/OPS/c1.xhtml']),
    );
  } finally {
    release.release();
    await settled;
  }
  const result = await operation;
  expect(requested).toHaveLength(3);
  expect(result.samples).toBeGreaterThan(3);
  expect(result).toMatchObject({ first: 0, last: 2, ordered: true, frames: true });
});
