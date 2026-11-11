/** Verify real CSS columns and immutable page counts with original long-form text. */
import { expect, test } from 'vitest';
import { book, host } from './fixture';

const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p{margin:0;font:16px/20px monospace}</style></head><body><p>${'Original text for pagination. '.repeat(300)}</p></body></html>`;

test('paginates long text and switches between single and double-column views', async () => {
  const publication = await book(chapter);
  const container = host();
  const reader = publication.renderTo(container, { spread: 'none', gap: 20 });
  try {
    expect(reader.layout({ gap: 24 })).toBeNull();
    await reader.display();
    const single = reader.pagination;
    expect(single?.columnsPerView).toBe(1);
    expect(single?.pageCount).toBeGreaterThan(1);
    expect(reader.getContents()?.compatMode).toBe('CSS1Compat');
    expect(reader.getContents()?.body.style.columnWidth).toBe('320px');
    const spread = reader.layout({ spread: 'always', gap: 20 });
    expect(spread?.columnsPerView).toBe(2);
    expect(spread?.columnWidth).toBe(150);
    expect(reader.getContents()?.body.style.columnCount).toBe('2');
    expect(reader.getContents()?.body.style.columnGap).toBe('20px');
    expect(Object.isFrozen(spread)).toBe(true);
    expect(() => reader.layout({ gap: -1 })).toThrow(RangeError);
    expect(reader.pagination).toBe(spread);
    reader.hide();
    expect(reader.layout({ spread: 'none' })?.width).toBe(320);
    expect(reader.frame.hidden).toBe(true);
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('auto spread mode follows actual iframe width and preserves readable final-spread extent', async () => {
  const publication = await book(chapter);
  const container = host();
  container.style.width = '900px';
  const reader = publication.renderTo(container, { minSpreadWidth: 800 });
  try {
    await reader.display();
    expect(reader.pagination?.columnsPerView).toBe(2);
    expect(reader.getContents()?.documentElement.scrollWidth).toBeGreaterThan(900);
    expect(reader.layout({ minSpreadWidth: 1000 })?.columnsPerView).toBe(1);
    container.style.display = 'none';
    expect(() => reader.layout()).toThrow(RangeError);
    expect(reader.frame.style.visibility).toBe('');
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('handles short and empty chapters without zero pages', async () => {
  const publication = await book(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body/></html>',
  );
  const container = host();
  const reader = publication.renderTo(container, { spread: 'always', gap: 0 });
  try {
    await reader.display();
    expect(reader.pagination?.pageCount).toBe(1);
    expect(reader.pagination?.columns).toBe(2);
  } finally {
    publication.destroy();
    container.remove();
  }
});
