/** Reflow must preserve a logical reading anchor during native resize and media-query changes. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { navigationFiles } from '../browser/render/navigation-fixture';
import type { ReadingFlow } from '../../src/index';

const flows: readonly ReadingFlow[] = ['paginated', 'scrolled-doc'];

for (const flow of flows) {
  test(`preserves the ${flow} reading anchor through viewport and media changes`, async ({
    page,
  }) => {
    const files = navigationFiles();
    files.set(
      'OPS/text/chapter one.xhtml',
      (files.get('OPS/text/chapter one.xhtml') ?? '').replace(
        '</style>',
        '@media(prefers-reduced-motion:reduce){p{font-size:32px!important;line-height:40px!important}}</style>',
      ),
    );
    await page.route('**/reflow.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(files)) }),
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const [result] = await Promise.all([
      page.evaluate(async (mode) => {
        const { runReflowScenario } = await import('../../tests/browser/render/reflow-scenario');
        return runReflowScenario('/reflow.epub', mode);
      }, flow),
      (async () => {
        await expect(page.locator('#reflow-ready')).toBeAttached();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(page.locator('#reflow-restore-ready')).toBeAttached();
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      })(),
    ]);
    expect(result.width).toBe(500);
    expect(result.resized, result.debug).toBe(true);
    expect(result.media).toBe(true);
    expect(result.expanded).toBeGreaterThan(result.length);
    expect(result.restored).toBe(true);
  });
}
