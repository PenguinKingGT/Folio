/** Fixed-page failures must reject predictably without exposing stale or invalid content. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';
import { fixedFiles } from '../../unit/layout/fixed-fixture';
import { host } from './fixture';
import { navigationFiles } from './navigation-fixture';

test('rejects fixed content with no viewport declaration', async () => {
  const files = fixedFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    (files.get('OPS/text/chapter one.xhtml') ?? '').replace(/<meta[^>]*\/>/, ''),
  );
  const publication = await Book.open(bookZip(files));
  const container = host();
  const reader = publication.renderTo(container);
  try {
    await expect(reader.display()).rejects.toThrow('viewport');
    expect(reader.getContents()).toBeNull();
    expect(reader.currentSection).toBeNull();
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('rejects non-local chapter references before performing any remote chapter read', async () => {
  const files = bookFiles();
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace(
      'href="text/chapter%20one.xhtml"',
      'href="https://original.invalid/foreign.xhtml"',
    ),
  );
  const publication = await Book.open(bookZip(files), { allowRemote: true });
  const container = host();
  try {
    await expect(publication.renderTo(container).display()).rejects.toThrow('local publication');
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('retains spread settings configured before the first display', async () => {
  const publication = await Book.open(bookZip(fixedFiles()));
  const container = host();
  const reader = publication.renderTo(container, { spread: 'always' });
  try {
    reader.layout({ spread: 'none' });
    await reader.display(1);
    expect(reader.fixedLayout?.primary.spread).toBe(false);
    expect(reader.getRenderedPages()).toHaveLength(1);
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('keeps observing retained content when another chapter fails before iframe replacement', async () => {
  const files = navigationFiles();
  files.delete('OPS/second.xhtml');
  const publication = await Book.open(bookZip(files));
  const container = host();
  const reader = publication.renderTo(container);
  let page = 0;
  reader.onRelocated((location) => {
    page = location.start.displayed.page;
  });
  try {
    await reader.display();
    const contents = reader.getContents();
    await expect(reader.display(2)).rejects.toThrow();
    expect(reader.getContents()).toBe(contents);
    contents?.defaultView?.scrollTo({ left: reader.pagination?.advance ?? 0, behavior: 'instant' });
    await expect.poll(() => page).toBe(2);
  } finally {
    publication.destroy();
    container.remove();
  }
});
