/** Headless progress CFIs must resolve against the actual passive reader DOM. */
import { expect, test } from 'vitest';
import { rangeFromCfi } from '../../../src/index';
import { book, host } from './fixture';

test('resolves every sampled CFI after passive elements and CDATA have been normalized', async () => {
  const publication = await book(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body id="original"><style>p{color:black}</style><p id="text">A<![CDATA[😀B]]><script>bad</script>CD</p><p>Next <em>word</em></p></body></html>',
  );
  const entries = await publication.locations.generate({ breakSize: 1 });
  const container = host();
  try {
    const reader = publication.renderTo(container);
    await reader.display();
    const contents = reader.getContents();
    if (contents === null) {
      throw new Error('Missing native reader contents.');
    }
    expect(contents.body.textContent).toContain('A😀BCD');
    for (const entry of entries) {
      const restored = rangeFromCfi(contents, entry.cfi);
      expect(restored.startContainer.nodeType).toBe(3);
      expect(restored.collapsed).toBe(true);
    }
    publication.locations.setCurrent(entries.length - 1);
    expect(publication.locations.percentageFromLocation(publication.locations.current ?? -1)).toBe(
      1,
    );
  } finally {
    publication.destroy();
    container.remove();
  }
});
