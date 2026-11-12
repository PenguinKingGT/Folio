/** Native engines open authored JSON publications without XML package requests or active publication code. */
import { expect, test } from '@playwright/test';
import { jsonFiles } from '../unit/manifest/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} JSON publication preserves native reading behavior`, async ({
    page,
  }) => {
    const files = jsonFiles();
    const requests: string[] = [];
    await page.route('**/json-publication/**', (route) => {
      const path = decodeURIComponent(
        new URL(route.request().url()).pathname.replace('/json-publication/', ''),
      );
      requests.push(path);
      const body = files.get(path);
      return route.fulfill({ body: body ?? 'missing', status: body === undefined ? 404 : 200 });
    });
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (seamless) => {
      const { runManifestScenario } = await import('../../tests/browser/manifest/scenario');
      return runManifestScenario(seamless);
    }, continuous);
    expect(result).toEqual({
      metadata: true,
      navigation: true,
      exact: true,
      passive: true,
      pages: true,
      cleaned: true,
    });
    expect(requests).not.toContain('OPS/package.opf');
    expect(requests).not.toContain('META-INF/container.xml');
    expect(requests).not.toContain('OPS/notes.xhtml');
  });
}
