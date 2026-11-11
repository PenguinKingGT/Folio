/** Annotation underlines follow native text axes across horizontal/vertical and RTL layout. */
import { expect, test } from 'vitest';
import { cfiFromRange } from '../../../src/index';
import { writingBook } from '../render/writing-fixture';
import { host } from '../render/fixture';
import { annotationGroup } from './fixture';

for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    test(`underlines native ${mode} ${direction} glyphs without CFI-visible wrappers`, async () => {
      const book = await writingBook(mode, direction);
      const container = host();
      const reader = book.renderTo(container, { spread: 'none' });
      try {
        await reader.display();
        const document = reader.getContents();
        const text = document?.querySelector('p')?.firstChild;
        if (!document || !text) {
          throw new Error('Missing writing-mode text.');
        }
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 15);
        const cfi = cfiFromRange(range, { base: '/6/2[chapter]' }).toString();
        const before = document.body.innerHTML;
        const annotation = reader.annotations.underline(cfi);
        const line = annotationGroup(reader, annotation.id)?.querySelector('line');
        expect(line).not.toBeNull();
        expect(line?.getAttribute('x1') === line?.getAttribute('x2')).toBe(
          mode !== 'horizontal-tb',
        );
        expect(line?.getAttribute('y1') === line?.getAttribute('y2')).toBe(
          mode === 'horizontal-tb',
        );
        expect(document.body.innerHTML).toBe(before);
        await reader.next();
        await reader.prev();
        await reader.annotations.whenIdle();
        expect(annotationGroup(reader, annotation.id)).not.toBeNull();
      } finally {
        book.destroy();
        container.remove();
      }
    });
  }
}
