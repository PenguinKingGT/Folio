/** Cross-engine native Range regression for UTF-16 selections after annotation insertion. */
import { expect, test } from '@playwright/test';

test('retains a CFI selection after DOM text is split by a mark', async ({ page }) => {
  await page.goto('/examples/basic/');
  await expect(page.getByRole('status')).toContainText('已加载');
  const result = await page.evaluate(async () => {
    const { cfiFromRange, rangeFromCfi } = await import('../../src/index');
    const chapter = document.implementation.createHTMLDocument('Original');
    chapter.body.innerHTML = '<p id="original">A😀BC</p>';
    const text = chapter.body.firstChild?.firstChild;
    if (text === null || text === undefined) {
      throw new Error('Missing original text.');
    }
    const selection = chapter.createRange();
    selection.setStart(text, 1);
    selection.setEnd(text, 4);
    const cfi = cfiFromRange(selection, { base: '/6/2', ignoreClass: 'mark' });
    const span = chapter.createElement('span');
    span.className = 'mark';
    selection.surroundContents(span);
    return rangeFromCfi(chapter, cfi, 'mark').toString();
  });
  expect(result).toBe('😀B');
});
