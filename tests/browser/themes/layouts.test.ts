/** Themes include hidden fixed companions, preloaded native documents, and asynchronously loaded reader fonts. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { fixedFiles } from '../../unit/layout/fixed-fixture';
import { bookZip } from '../../unit/book/fixture';
import { host } from '../render/fixture';
import { themedBook, contains } from './fixture';
import { originalFont } from './font-fixture';

test('styles hidden fixed companions before a later spread resize exposes them', async () => {
  const book = await Book.open(bookZip(fixedFiles()));
  const container = host();
  const reader = book.renderTo(container, { spread: 'none' });
  try {
    await reader.display(1);
    await reader.themes.registerCss('default', 'p{color:rgb(3,4,5)}');
    reader.layout({ spread: 'always' });
    expect(reader.getRenderedPages()).toHaveLength(2);
    for (const page of reader.getRenderedPages()) {
      expect(
        page.document.defaultView?.getComputedStyle(
          page.document.querySelector('p') ?? page.document.body,
        ).color,
      ).toBe('rgb(3, 4, 5)');
    }
    await reader.display(3);
    expect(reader.getContents()?.querySelector('[data-folio-theme]')?.textContent).toContain(
      'rgb(3,4,5)',
    );
  } finally {
    book.destroy();
    container.remove();
  }
});

test('awaits a requested original font and reflows without losing the current CFI', async () => {
  const { book, container, release } = await themedBook();
  const reader = book.renderTo(container, { spread: 'none' });
  try {
    await reader.display(5);
    await reader.next();
    await reader.next();
    const cfi = reader.currentLocation()?.start.cfi ?? '';
    const before = reader.pagination?.pageCount ?? 0;
    await reader.themes.registerCss(
      'wide',
      `@font-face{font-family:FolioWide;src:url(${await originalFont()})}p{font-family:FolioWide!important}`,
    );
    await reader.themes.select('wide');
    expect(reader.getContents()?.fonts.check('16px FolioWide')).toBe(true);
    expect(reader.pagination?.pageCount).toBeGreaterThan(before);
    expect(contains(reader.currentLocation(), cfi)).toBe(true);
  } finally {
    release();
  }
});

test('bounds named registrations and returns an immutable inventory', async () => {
  const { book, container, release } = await themedBook();
  const reader = book.renderTo(container);
  try {
    for (let index = 0; index < 63; index += 1) {
      await reader.themes.registerCss(`theme-${index}`, '');
    }
    expect(reader.themes.names).toHaveLength(64);
    expect(Object.isFrozen(reader.themes.names)).toBe(true);
    await expect(reader.themes.registerCss('overflow', '')).rejects.toThrow('Too many');
    await reader.themes.registerCss('theme-0', 'p{color:red}');
    await reader.themes.select('theme-0');
    await reader.themes.whenIdle();
  } finally {
    release();
  }
});
