/** Initial resize races are regression-tested at both headless-content and native-render preparation boundaries. */
import { expect, test } from 'vitest';
import { navigationBook } from '../render/navigation-fixture';
import { initialResize, endVisible } from './initial-resize';

for (const phase of ['content', 'render'] as const) {
  test(`keeps the first destination when resize occurs during ${phase} preparation`, async () => {
    const { book, reader, host } = await initialResize(await navigationBook(), phase);
    try {
      expect(reader.pagination?.width).toBe(500);
      expect(reader.getContents()?.body.textContent).toContain('Final destination');
      expect(endVisible(reader)).toBe(true);
      expect(reader.frame.hidden).toBe(false);
      const document = reader.getContents();
      host.style.width = '640px';
      await expect.poll(() => reader.pagination?.width).toBe(640);
      expect(reader.getContents()).toBe(document);
      expect(endVisible(reader)).toBe(true);
    } finally {
      book.destroy();
      host.remove();
    }
  });
}
