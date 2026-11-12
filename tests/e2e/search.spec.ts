/** Headless cross-node search CFIs must remain exact in Chromium, Firefox, and WebKit native DOMs. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { searchChapter, searchFiles } from '../unit/search/fixture';

for (const asserted of [true, false]) {
  test(`search ranges navigate and annotate with ${asserted ? 'ID assertions' : 'numeric paths'}`, async ({
    page,
  }) => {
    const files = searchFiles(true);
    if (!asserted) {
      files.set('OPS/text/chapter one.xhtml', searchChapter.replace(/\s+id="[^"]*"/g, ''));
    }
    await page.route('**/search.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(files)) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async () => {
      const { runSearchScenario } = await import('../../tests/browser/search/scenario');
      return runSearchScenario();
    });
    expect(result).toEqual({ exact: true, painted: true, stable: true, packageStep: true });
  });
}
