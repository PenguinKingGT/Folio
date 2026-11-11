/** Reader-owned stylesheet load notifications cannot roll back a subsequent native reading intent. */
import { expect, test } from 'vitest';
import { themedBook } from './fixture';

test('reports immediate native scrolling after displaying an already themed chapter', async () => {
  const { book, container, release } = await themedBook();
  const reader = book.renderTo(container, { spread: 'none' });
  let page = 0;
  reader.onRelocated((location) => {
    page = location.start.displayed.page;
  });
  try {
    await reader.themes.registerCss('default', 'p{color:red}');
    await reader.display(4);
    reader
      .getContents()
      ?.defaultView?.scrollTo({ left: (reader.pagination?.advance ?? 0) * 2, behavior: 'instant' });
    await expect.poll(() => page).toBe(3);
  } finally {
    release();
  }
});
