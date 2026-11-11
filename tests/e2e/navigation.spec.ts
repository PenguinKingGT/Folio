/** Cross-engine navigation verifies real columns, exact CFI seeks, and linear chapter transitions. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { navigationFiles } from '../browser/render/navigation-fixture';

test('seeks precise destinations and turns pages across chapter boundaries', async ({ page }) => {
  await page.route('**/navigation.epub', (route) =>
    route.fulfill({ body: Buffer.from(bookZip(navigationFiles())) }),
  );
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await navigate(page);
  expect(result.pageOffset).toBe(344);
  expect(result.anchorOffset).toBeGreaterThan(0);
  expect(result.cfiOffset).toBe(result.anchorOffset);
  expect(result.next).toBe(2);
  expect(result.previous).toBe(0);
  expect(result.previousOffset).toBeGreaterThan(0);
  expect(result.end).toBe(2);
});

/** Exercise navigation inside the publication realm and return observable coordinates. */
async function navigate(page: Page) {
  return page.evaluate(async () => {
    const { Book, cfiFromNode } = await import('../../src/index');
    const host = document.createElement('div');
    host.style.width = '320px';
    host.style.height = '240px';
    document.body.appendChild(host);
    const book = await Book.open('/navigation.epub');
    const reader = book.renderTo(host);
    try {
      await reader.display();
      await reader.next();
      const pageOffset = reader.getContents()?.defaultView?.scrollX;
      await reader.display('#end');
      const contents = reader.getContents();
      const end = contents?.getElementById('end');
      if (!end) {
        throw new Error('Missing end anchor.');
      }
      const cfi = cfiFromNode(end, { base: '/6/2[chapter]' }).toString();
      const anchorOffset = contents?.defaultView?.scrollX;
      await reader.display(0);
      await reader.display(cfi);
      const cfiOffset = contents?.defaultView?.scrollX;
      const next = (await reader.next())?.index;
      const previous = (await reader.prev())?.index;
      const previousOffset = reader.getContents()?.defaultView?.scrollX;
      await reader.display({ percentage: 1 });
      return {
        pageOffset,
        anchorOffset,
        cfiOffset,
        next,
        previous,
        previousOffset,
        end: reader.currentSection?.index,
      };
    } finally {
      book.destroy();
      host.remove();
    }
  });
}
