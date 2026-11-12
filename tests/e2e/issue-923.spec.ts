/** Native font decoding and glyph metrics must work for a standard-obfuscated original EPUB fixture. */
import { expect, test } from '@playwright/test';

for (const obfuscated of [false, true]) {
  test(`${obfuscated ? 'IDPF-obfuscated' : 'ordinary'} embedded font supplies its actual glyph metrics`, async ({
    page,
  }) => {
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(
      async (encoded) =>
        (await import('../../tests/browser/issues/obfuscated-font')).obfuscatedFontScenario(
          encoded,
        ),
      obfuscated,
    );
    expect(result.loaded).toBe(1);
    expect(result.width).toBe(96);
  });
}
