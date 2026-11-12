/** Native cross-paragraph underlines retain every middle-paragraph line in all three browser engines. */
import { expect, test } from '@playwright/test';

for (const lineHeight of [24, 12]) {
  test(`cross-paragraph underlines preserve each text line with line-height ${lineHeight}`, async ({
    page,
  }) => {
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (height) => {
      const { paragraphUnderline } = await import('../../tests/browser/issues/paragraph-underline');
      return paragraphUnderline(height);
    }, lineHeight);
    expect(result.expected).toBeGreaterThan(1);
    expect(result.matched).toBe(result.expected);
    expect(result.error).toBe(false);
  });
}
