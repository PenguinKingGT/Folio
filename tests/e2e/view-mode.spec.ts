/** Every native engine enforces the built-in iframe boundary instead of silently inserting publisher HTML into host DOM. */
import { expect, test } from '@playwright/test';
import { bookZip, bookFiles } from '../unit/book/fixture';

test('legacy inline mode rejects and iframe mode retains host style/document isolation', async ({
  page,
}) => {
  const files = bookFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p{color:red!important}body{margin:0}</style></head><body><p>Original publisher text</p><script>parent.document.body.textContent="unsafe";</script></body></html>',
  );
  await page.route('**/view-mode.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(files)) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { runViewModeScenario } = await import('../../tests/browser/render/view-mode-scenario');
    return runViewModeScenario();
  });
  expect(result).toEqual({ rejected: true, untouched: true, isolated: true });
});
