/** Cross-engine rendering verifies actual dimensions, passive scripts and book-owned cleanup. */
import { expect, test } from '@playwright/test';
import { bookFiles, bookZip } from '../unit/book/fixture';

test('renders a passive chapter and releases the owned iframe', async ({ page }) => {
  const files = bookFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><script>parent.document.body.setAttribute("data-executed","yes")</script></head><body><p>Original rendered chapter</p></body></html>',
  );
  await page.route('**/render.epub', (route) =>
    route.fulfill({ contentType: 'application/epub+zip', body: Buffer.from(bookZip(files)) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { Book } = await import('../../src/index');
    const host = document.createElement('div');
    host.style.width = '320px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const book = await Book.open('/render.epub');
    const reader = book.renderTo(host, { height: 160 });
    await reader.display();
    const text = reader.getContents()?.body.textContent;
    const height = reader.frame.getBoundingClientRect().height;
    const scripts = reader.getContents()?.querySelectorAll('script').length;
    const executed = document.body.hasAttribute('data-executed');
    reader.hide();
    const hidden = getComputedStyle(reader.frame).display;
    reader.show();
    book.destroy();
    const remaining = host.children.length;
    host.remove();
    return { text, height, scripts, executed, hidden, remaining };
  });
  expect(result).toEqual({
    text: 'Original rendered chapter',
    height: 160,
    scripts: 0,
    executed: false,
    hidden: 'none',
    remaining: 0,
  });
});
