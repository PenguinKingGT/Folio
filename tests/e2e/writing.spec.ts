/** Signed scrolling and vertical writing must behave consistently across Chromium, Firefox, and WebKit. */
import { expect, test } from '@playwright/test';
import { bookZip } from '../unit/book/fixture';
import { writingFiles } from '../browser/render/writing-fixture';

for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    for (const flow of ['paginated', 'scrolled-doc'] as const) {
      test(`${flow}: ${mode} ${direction} uses consistent logical reading positions`, async ({
        page,
      }) => {
        await page.route('**/writing.epub', (route) =>
          route.fulfill({ body: Buffer.from(bookZip(writingFiles(mode, direction))) }),
        );
        await page.goto('/examples/basic/');
        await expect(page.getByRole('status')).toContainText('已加载');
        const result = await page.evaluate(async (readingFlow) => {
          const { runWritingScenario } =
            await import('../../tests/browser/render/writing-scenario');
          return runWritingScenario(readingFlow);
        }, flow);
        expect(result.state?.writingMode).toBe(mode);
        expect(result.state?.direction).toBe(direction);
        expect(result.native).toBe(result.expected);
        expect(result.page).toBe(2);
        expect(result.atEnd).toBe(true);
        expect(result.restored).toBe(true);
        expect(result.spreadEnd).toBe(true);
      });
    }
  }
}
