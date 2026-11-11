/** Native fixed-layout tests cover containing blocks, real facing documents, navigation, and mixed layouts. */
import { afterEach, expect, test } from 'vitest';
import { Book, Cfi, rangeFromCfi } from '../../../src/index';
import type { RenditionOptions } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { fixedChapter, fixedFiles } from '../../unit/layout/fixed-fixture';
import { host } from './fixture';

const opened: { book: Book; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ book, container }) => {
    book.destroy();
    container.remove();
  }),
);

/** Attach a fixed book to a large measurable viewport and register cleanup. */
async function mounted(files = fixedFiles(), options: RenditionOptions = { spread: 'always' }) {
  const publication = await Book.open(bookZip(files));
  const container = host();
  container.style.width = '1200px';
  container.style.height = '800px';
  opened.push({ book: publication, container });
  return { publication, container, reader: publication.renderTo(container, options) };
}

test('scales the original containing block without rewriting author positioning', async () => {
  const { reader, container } = await mounted(fixedFiles(), {
    spread: 'none',
    flow: 'scrolled-doc',
  });
  expect(reader.fixedLayout).toBeNull();
  expect(reader.getRenderedPages()).toEqual([]);
  container.style.width = '1000px';
  container.style.height = '600px';
  await reader.display();
  expect(reader.fixedLayout?.primary).toMatchObject({
    width: 600,
    height: 800,
    scale: 0.75,
    x: 275,
    y: 0,
    spread: false,
  });
  expect(reader.frame.contentWindow?.innerWidth).toBe(600);
  expect(reader.frame.contentWindow?.innerHeight).toBe(800);
  expect(reader.frame.getBoundingClientRect().width).toBe(450);
  const position = reader.getContents()?.getElementById('position')?.getBoundingClientRect();
  expect(position?.left).toBe(300);
  expect(position?.top).toBe(400);
  expect(reader.pagination).toBeNull();
  expect(reader.flowState?.flow).toBe('paginated');
  expect(reader.flow('scrolled-doc', 'vertical')?.flow).toBe('paginated');
  expect(reader.currentLocation()?.start.displayed).toEqual({ page: 1, total: 1 });
});

test('renders gapless facing documents and turns across the whole visible spread', async () => {
  const { reader, container } = await mounted(fixedFiles(), { spread: 'always', gap: 80 });
  await reader.display(1);
  const pages = reader.getRenderedPages();
  expect(pages.map((page) => page.section.index)).toEqual([1, 2]);
  const left = pages[0]?.frame.getBoundingClientRect();
  const right = pages[1]?.frame.getBoundingClientRect();
  expect(left?.right).toBe(right?.left);
  expect(left?.width).toBe(600);
  const location = reader.currentLocation();
  expect(location?.start.index).toBe(1);
  expect(location?.end.index).toBe(2);
  for (const page of pages) {
    const cfi = page.section.index === 1 ? location?.start.cfi : location?.end.cfi;
    expect(new Cfi(cfi ?? '').spineIndex).toBe(page.section.index);
    expect(rangeFromCfi(page.document, cfi ?? '').startContainer.nodeType).toBe(3);
  }
  expect((await reader.next())?.index).toBe(3);
  expect(reader.currentLocation()?.atEnd).toBe(true);
  expect(await reader.next()).toBeNull();
  expect((await reader.prev())?.index).toBe(2);
  expect(reader.getRenderedPages().map((page) => page.section.index)).toEqual([1, 2]);
  expect((await reader.prev())?.index).toBe(0);
  expect(reader.fixedLayout?.primary.x).toBe(600);
  expect(reader.currentLocation()?.atStart).toBe(true);
  expect(await reader.prev()).toBeNull();
  reader.destroy();
  expect(container.children.length).toBe(0);
});

test('switches between single and paired views without loading another document', async () => {
  const { reader, container } = await mounted();
  await reader.display(2);
  const pages = reader.getRenderedPages();
  reader.hide();
  expect(pages.every((page) => page.frame.hidden)).toBe(true);
  expect(reader.currentLocation()?.start.index).toBe(1);
  reader.layout({ spread: 'none' });
  expect(reader.getRenderedPages().map((page) => page.section.index)).toEqual([2]);
  expect(reader.fixedLayout?.primary.x).toBe(300);
  reader.show();
  expect(pages.find((page) => page.section.index === 1)?.frame.hidden).toBe(true);
  reader.layout({ spread: 'always' });
  expect(reader.getRenderedPages().map((page) => page.document)).toEqual(
    pages.map((page) => page.document),
  );
  container.style.width = '800px';
  await expect.poll(() => reader.fixedLayout?.width).toBe(800);
  expect(reader.fixedLayout?.primary.scale).toBeCloseTo(2 / 3);
  expect(reader.currentLocation()?.start.index).toBe(1);
  await reader.display('#page-2');
  expect(reader.getContents()?.defaultView?.scrollX).toBe(0);
});

test('honors RTL physical sides and explicit centered pages', async () => {
  const { reader } = await mounted(fixedFiles(['', 'rendition:page-spread-center'], 'rtl'));
  await reader.display();
  expect(reader.fixedLayout?.primary.side).toBe('left');
  await reader.display(1);
  expect(reader.fixedLayout?.primary).toMatchObject({ side: 'center', spread: false, x: 300 });
  expect(reader.getRenderedPages()).toHaveLength(1);
  await reader.display(2);
  expect(reader.fixedLayout?.primary.side).toBe('left');
});

test('resolves package and item-level spread policies before reader overrides', async () => {
  for (const preference of ['none', 'both', 'portrait', 'landscape', 'auto']) {
    const { reader, container } = await mounted(fixedFiles([], 'ltr', preference), {
      spread: 'auto',
    });
    container.style.width = '600px';
    await reader.display(1);
    expect(reader.fixedLayout?.primary.spread).toBe(['both', 'portrait'].includes(preference));
    container.style.width = '1000px';
    container.style.height = '500px';
    await expect.poll(() => reader.fixedLayout?.width).toBe(1000);
    expect(reader.fixedLayout?.primary.spread).toBe(
      ['both', 'landscape', 'auto'].includes(preference),
    );
  }
  const { reader } = await mounted(fixedFiles(['', 'rendition:spread-none'], 'ltr', 'both'), {
    spread: 'auto',
  });
  await reader.display(1);
  expect(reader.fixedLayout?.primary.spread).toBe(false);
  reader.layout({ spread: 'always' });
  expect(reader.fixedLayout?.primary.spread).toBe(true);
});

test('restores reflow geometry when a mixed-layout spine overrides package defaults', async () => {
  const files = fixedFiles(['', 'rendition:layout-reflowable']);
  files.set(
    'OPS/p1.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>${'Original reflowable text. '.repeat(500)}</p></body></html>`,
  );
  const { reader, container } = await mounted(files, { spread: 'none' });
  container.style.width = '320px';
  container.style.height = '240px';
  await reader.display();
  await reader.display(1);
  expect(reader.fixedLayout).toBeNull();
  expect(reader.pagination?.pageCount).toBeGreaterThan(1);
  expect(reader.frame.style.position).toBe('');
  expect(reader.frame.style.transform).toBe('');
  await reader.next();
  expect(reader.currentSection?.index).toBe(1);
  await reader.display(2);
  expect(reader.pagination).toBeNull();
  expect(reader.getRenderedPages()).toHaveLength(1);
});

test('rejects invalid primary and companion viewports and can retry repaired source documents', async () => {
  for (const index of [0, 2]) {
    const files = fixedFiles();
    const path = index === 0 ? 'OPS/text/chapter one.xhtml' : 'OPS/p2.xhtml';
    files.set(path, fixedChapter(index, 'width=device-width'));
    const { reader, publication, container } = await mounted(files);
    const target = index === 0 ? 0 : 1;
    await expect(reader.display(target)).rejects.toThrow('viewport');
    expect(reader.getContents()).toBeNull();
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
    const document = await publication.section(index)?.load();
    document?.getElementsByTagName('meta')[0]?.setAttribute('content', 'width=600,height=800');
    await reader.display(target);
    expect(reader.fixedLayout?.primary.width).toBe(600);
  }
});
