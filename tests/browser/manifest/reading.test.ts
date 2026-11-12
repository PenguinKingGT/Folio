/** JSON publications reuse native passive views, exact search CFIs, annotations, printed pages, and nonlinear navigation. */
import { expect, test } from 'vitest';
import { Book, rangeFromCfi } from '../../../src/index';
import { jsonTransport } from '../../unit/manifest/fixture';
import { host } from '../render/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} JSON reading keeps package identity and passive chapter isolation`, async () => {
    const transport = jsonTransport();
    const book = await Book.open('https://original.invalid/OPS/manifest.json', {
      fetch: transport.fetch,
    });
    const container = host();
    const reader = continuous ? book.renderContinuous(container) : book.renderTo(container);
    try {
      expect(transport.calls).toEqual(['OPS/manifest.json']);
      const result = (await book.section()?.search('Original JSON'))?.[0];
      if (!result) {
        throw new Error('Missing JSON search match.');
      }
      await reader.display(result.cfi);
      const document = reader.getContents();
      if (!document) {
        throw new Error('Missing JSON native chapter.');
      }
      expect(rangeFromCfi(document, result.cfi).toString()).toBe('Original JSON');
      expect(document.querySelector('script')).toBeNull();
      expect(Reflect.get(document.defaultView ?? {}, 'untrustedJson')).toBeUndefined();
      reader.annotations.highlight(result.cfi);
      expect(reader.annotations.element.querySelector('rect')).not.toBeNull();
      await book.pageList.generate();
      expect(book.pageList.entries[0]?.cfi).toContain('/6/2[chapter]!');
      expect(book.spine.adjacent(0, 'next')?.index).toBe(2);
      if (!continuous) {
        await reader.next();
        expect(reader.currentSection?.index).toBe(2);
      } else {
        expect((await reader.display(2)).index).toBe(2);
      }
      expect(
        reader.getRenderedPages().find((page) => page.section.index === 2)?.document.body
          .textContent,
      ).toContain('Original ending');
      expect(transport.calls).not.toContain('OPS/notes.xhtml');
      await book.destroyAsync();
      expect(container.querySelector('iframe')).toBeNull();
    } finally {
      book.destroy();
      container.remove();
    }
  });
}
