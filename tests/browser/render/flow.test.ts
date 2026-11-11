/** Native scrolling tests verify scroll extents, mode transitions, and hidden-reader behavior. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';
import { book, host } from './fixture';

const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p{font:16px/20px monospace;margin:0}</style></head><body><p>${'Original scrolling text. '.repeat(300)}</p></body></html>`;

test('switches between native vertical scrolling, horizontal scrolling and pagination', async () => {
  const publication = await book(chapter);
  const container = host();
  const reader = publication.renderTo(container, { flow: 'scrolled-doc' });
  try {
    expect(reader.flow('scrolled-continuous')).toBeNull();
    await reader.display();
    expect(reader.flowState?.flow).toBe('scrolled-continuous');
    expect(reader.flowState?.axis).toBe('vertical');
    expect(reader.flowState?.length).toBeGreaterThan(240);
    expect(reader.pagination).toBeNull();
    const document = reader.getContents();
    document?.defaultView?.scrollTo(0, 100);
    expect(document?.defaultView?.scrollY).toBe(100);
    reader.hide();
    expect(reader.flow('scrolled-doc', 'horizontal')?.length).toBeGreaterThan(320);
    expect(reader.frame.hidden).toBe(true);
    expect(reader.flowState?.axis).toBe('horizontal');
    reader.show();
    document?.defaultView?.scrollTo(100, 0);
    expect(document?.defaultView?.scrollX).toBe(100);
    expect(document?.documentElement.style.scrollbarWidth).toBe('none');
    reader.flow('paginated');
    expect(reader.pagination?.columnsPerView).toBe(1);
    reader.flow('scrolled-doc');
    expect(document?.body.style.columnWidth).toBe('auto');
    expect(document?.body.style.height).toBe('auto');
    expect(reader.flow('auto')?.flow).toBe('paginated');
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('auto flow honors package metadata while explicit pagination overrides it', async () => {
  const files = bookFiles();
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace(
      '</metadata>',
      '<meta property="rendition:flow">scrolled-doc</meta></metadata>',
    ),
  );
  const publication = await Book.open(bookZip(files));
  const container = host();
  try {
    const reader = publication.renderTo(container);
    await reader.display();
    expect(reader.flowState?.flow).toBe('scrolled-doc');
    reader.flow('paginated');
    expect(reader.pagination?.pageCount).toBe(1);
    expect(reader.flow('auto')?.flow).toBe('scrolled-doc');
  } finally {
    publication.destroy();
    container.remove();
  }
});
