/** Verify real-browser XML/CSS parsing and native Blob resource ownership. */
import { expect, test } from '@playwright/test';

test('rewrites and releases CSS resources in the browser', async ({ page }) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { Resources, parsePackage } = await import('../../src/index');
    const publication =
      parsePackage(`<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="id">
      <metadata><dc:identifier id="id">original</dc:identifier><dc:title>Original</dc:title><dc:language>en</dc:language></metadata>
      <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="style" href="main.css" media-type="text/css"/></manifest>
      <spine><itemref idref="chapter"/></spine></package>`);
    const resources = new Resources(publication, 'OPS/book.opf', (path) =>
      Promise.resolve(
        new TextEncoder().encode(
          path.endsWith('.css') ? 'p{background:url(image.png)}' : 'original bytes',
        ),
      ),
    );
    const url = await resources.url('main.css');
    const css = await (await fetch(url)).text();
    resources.destroy();
    let revoked = false;
    try {
      await fetch(url);
    } catch {
      revoked = true;
    }
    return { css, revoked };
  });
  expect(result.css).toContain('url(blob:');
  expect(result.revoked).toBe(true);
});
