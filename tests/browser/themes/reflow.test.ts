/** Font and theme changes keep the same logical reading point visible across bounded and continuous views. */
import { expect, test } from 'vitest';
import { themedBook, contains } from './fixture';

test('preserves a reading CFI through repeated font-size and family overrides', async () => {
  const { book, container, release } = await themedBook();
  const reader = book.renderTo(container, { spread: 'none' });
  try {
    await reader.display(4);
    await reader.next();
    await reader.next();
    const cfi = reader.currentLocation()?.start.cfi ?? '';
    for (const size of [24, 12, 30, 16, 28, 14]) {
      await reader.themes.fontSize(size);
      expect(contains(reader.currentLocation(), cfi)).toBe(true);
    }
    await reader.themes.font('serif');
    expect(contains(reader.currentLocation(), cfi)).toBe(true);
    expect(
      reader.getContents()?.defaultView?.getComputedStyle(reader.getContents()?.body ?? container)
        .fontFamily,
    ).toBe('serif');
    await reader.themes.removeOverride('font-family');
    await reader.themes.fontSize('120%');
    expect(contains(reader.currentLocation(), cfi)).toBe(true);
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing font document.');
    }
    const rootSize = document.defaultView?.getComputedStyle(document.documentElement).fontSize;
    const paragraphSize = document.defaultView?.getComputedStyle(
      document.querySelector('p') ?? document.body,
    ).fontSize;
    expect(paragraphSize).toBe(rootSize);
  } finally {
    release();
  }
});

test('updates loaded continuous neighbors and preserves the reading point after trimming', async () => {
  const { book, container, release } = await themedBook();
  const reader = book.renderContinuous(container);
  try {
    await reader.display(4);
    await reader.next();
    const cfi = reader.currentLocation()?.start.cfi ?? '';
    await reader.themes.fontSize(24);
    await reader.whenIdle();
    expect(contains(reader.currentLocation(), cfi)).toBe(true);
    for (const page of reader.getLoadedPages()) {
      expect(
        page.document.defaultView?.getComputedStyle(
          page.document.querySelector('p') ?? page.document.body,
        ).fontSize,
      ).toBe('24px');
    }
    await reader.display(6);
    expect(reader.getContents()?.querySelector('[data-folio-theme]')?.textContent).toContain(
      '24px',
    );
    await reader.themes.fontSize(12);
    await reader.whenIdle();
    expect(reader.currentSection?.index).toBe(6);
  } finally {
    release();
  }
});
